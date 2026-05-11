import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, PersistedPayment } from '../database/database.service';
import { RouterOSService } from '../routeros/routeros.service';
import { CreateTicketDto, TicketQueryDto, TicketStatus, UpdateTicketDto } from './tickets.dto';

@Injectable()
export class TicketsService {
  constructor(
    private database: DatabaseService,
    private routeros: RouterOSService,
  ) {}

  private normalizeTicketStatus(status?: string) {
    switch ((status || '').trim().toLowerCase()) {
      case 'active':
      case 'open':
      case 'in progress':
      case 'resolved':
        return TicketStatus.ACTIVE;
      case 'expired':
      case 'closed':
        return TicketStatus.EXPIRED;
      default:
        return TicketStatus.ACTIVE;
    }
  }

  private mapTicket<T extends { status?: string }>(ticket: T) {
    return {
      ...ticket,
      status: this.normalizeTicketStatus(ticket.status),
    };
  }

  private nextTicketId(tickets: { id: string }[]) {
    const maxId = tickets.reduce((max, ticket) => {
      const value = parseInt(ticket.id.replace(/^t/, ''), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `t${maxId + 1}`;
  }

  private nextTicketNumber(tickets: { ticketNumber: string }[]) {
    const currentYear = new Date().getFullYear();
    const maxNumber = tickets.reduce((max, ticket) => {
      const suffix = parseInt(ticket.ticketNumber.split('-').pop() || '0', 10);
      return Number.isNaN(suffix) ? max : Math.max(max, suffix);
    }, 0);

    return `TCK-${currentYear}-${String(maxNumber + 1).padStart(5, '0')}`;
  }

  async findAll(query: TicketQueryDto) {
    let tickets = (await this.database.getTickets()).map((ticket) => this.mapTicket(ticket));

    if (query.clientId) {
      tickets = tickets.filter((ticket) => ticket.clientId === query.clientId);
    }

    if (query.paymentId) {
      tickets = tickets.filter((ticket) => ticket.paymentId === query.paymentId);
    }

    if (query.status) {
      tickets = tickets.filter((ticket) => ticket.status === query.status);
    }

    return {
      total: tickets.length,
      data: tickets,
    };
  }

  async findOne(id: string) {
    const tickets = await this.database.getTickets();
    const ticket = tickets.find((item) => item.id === id);

    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} introuvable`);
    }

    return this.mapTicket(ticket);
  }

  async lookupByTicketNumber(ticketNumber: string) {
    const tickets = await this.database.getTickets();
    const ticket = tickets.find(
      (item) => item.ticketNumber.toLowerCase() === ticketNumber.toLowerCase(),
    );

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketNumber} introuvable`);
    }

    return this.mapTicket(ticket);
  }

  async create(dto: CreateTicketDto) {
    const tickets = await this.database.getTickets();
    const now = new Date().toISOString();
    const newTicket = {
      id: this.nextTicketId(tickets),
      ticketNumber: this.nextTicketNumber(tickets),
      paymentId: dto.paymentId || '',
      clientId: dto.clientId || '',
      client: dto.client,
      invoice: dto.invoice,
      amount: dto.amount || '',
      title: dto.title,
      description: dto.description || 'Ticket genere manuellement.',
      status: this.normalizeTicketStatus(dto.status) || TicketStatus.ACTIVE,
      used: false,
      createdAt: now,
      updatedAt: now,
    };

    tickets.push(newTicket);
    await this.database.saveTickets(tickets);
    return newTicket;
  }

  async createFromPayment(payment: PersistedPayment) {
    const tickets = await this.database.getTickets();
    const existing = tickets.find((ticket) => ticket.paymentId === payment.id);

    if (existing) {
      return existing;
    }

    return this.create({
      paymentId: payment.id,
      clientId: payment.clientId,
      client: payment.client,
      invoice: payment.invoice,
      amount: payment.amount,
      title: `Paiement enregistre pour ${payment.invoice}`,
      description: payment.notes || 'Ticket genere automatiquement apres paiement.',
      status: payment.state === 'Collected' ? TicketStatus.ACTIVE : TicketStatus.EXPIRED,
    });
  }

  async validateTicketForHotspot(
    ticketNumber: string,
    ip?: string,
    macAddress?: string,
    linkLogin?: string,
    linkOrig?: string,
  ) {
    const tickets = await this.database.getTickets();
    const index = tickets.findIndex(
      (item) => item.ticketNumber.toLowerCase() === ticketNumber.toLowerCase(),
    );

    if (index === -1) {
      throw new NotFoundException(`Ticket ${ticketNumber} introuvable`);
    }

    const ticket = tickets[index];

    const normalizedStatus = this.normalizeTicketStatus(ticket.status);

    if (normalizedStatus === TicketStatus.EXPIRED) {
      throw new BadRequestException(`Ticket ${ticketNumber} expire`);
    }

    const payments = await this.database.getPayments();
    const payment = payments.find((item) => item.id === ticket.paymentId);
    const plans = await this.database.getPlans();
    const linkedPlan = payment?.planId
      ? plans.find((item) => item.id === payment.planId)
      : null;
    const rateLimit = linkedPlan
      ? `${linkedPlan.download}M/${linkedPlan.upload}M`
      : undefined;

    await this.routeros.ensureTemporaryHotspotUser(
      ticket.ticketNumber,
      macAddress,
      'default',
      rateLimit,
    );

    let resolvedIp = ip || '';

    if (macAddress) {
      const hotspotHost = await this.routeros.getHotspotHostByMacAddress(macAddress);
      resolvedIp =
        hotspotHost?.address ||
        hotspotHost?.['to-address'] ||
        hotspotHost?.host ||
        resolvedIp;
    }

    let directLoginSucceeded = false;

    if (resolvedIp) {
      try {
        await this.routeros.loginHotspotClient(ticket.ticketNumber, resolvedIp, macAddress);
        directLoginSucceeded = true;
      } catch {
        directLoginSucceeded = false;
      }
    }

    const usedAt = new Date().toISOString();
    const baseLoginLink = linkLogin || (await this.routeros.getHotspotLoginLink());
    const loginRedirectUrl = `${baseLoginLink}${baseLoginLink.includes('?') ? '&' : '?'}username=${encodeURIComponent(ticket.ticketNumber)}&password=${encodeURIComponent(ticket.ticketNumber)}`;
    const successRedirectUrl = linkOrig || '';
    const redirectUrl = directLoginSucceeded ? successRedirectUrl : loginRedirectUrl;

    tickets[index] = {
      ...ticket,
      used: true,
      usedAt,
      usedByIp: resolvedIp,
      usedByMac: macAddress || '',
      status: TicketStatus.ACTIVE,
      updatedAt: usedAt,
    };

    await this.database.saveTickets(tickets);

    return {
      valid: true,
      ticketNumber: tickets[index].ticketNumber,
      client: tickets[index].client,
      status: tickets[index].status,
      directLoginSucceeded,
      redirectUrl,
      usedAt,
    };
  }

  async update(id: string, dto: UpdateTicketDto) {
    const tickets = await this.database.getTickets();
    const index = tickets.findIndex((ticket) => ticket.id === id);

    if (index === -1) {
      throw new NotFoundException(`Ticket #${id} introuvable`);
    }

    const currentTicket = this.mapTicket(tickets[index]);
    const nextStatus = dto.status ? this.normalizeTicketStatus(dto.status) : currentTicket.status;
    const updatedAt = new Date().toISOString();

    tickets[index] = {
      ...tickets[index],
      ...dto,
      status: nextStatus,
      used: nextStatus === TicketStatus.EXPIRED,
      usedAt: nextStatus === TicketStatus.EXPIRED ? tickets[index].usedAt || updatedAt : '',
      usedByIp: nextStatus === TicketStatus.EXPIRED ? tickets[index].usedByIp || '' : '',
      usedByMac: nextStatus === TicketStatus.EXPIRED ? tickets[index].usedByMac || '' : '',
      updatedAt,
    };

    await this.database.saveTickets(tickets);
    return this.mapTicket(tickets[index]);
  }

  async remove(id: string) {
    const tickets = await this.database.getTickets();
    const index = tickets.findIndex((ticket) => ticket.id === id);

    if (index === -1) {
      throw new NotFoundException(`Ticket #${id} introuvable`);
    }

    tickets.splice(index, 1);
    await this.database.saveTickets(tickets);
    return { message: `Ticket #${id} supprimé` };
  }

  async removeByPaymentId(paymentId: string) {
    const tickets = await this.database.getTickets();
    const filtered = tickets.filter((ticket) => ticket.paymentId !== paymentId);
    await this.database.saveTickets(filtered);
  }
}