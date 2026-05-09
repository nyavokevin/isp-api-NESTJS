import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService, PersistedPayment } from '../database/database.service';
import { TicketsService } from '../tickets/tickets.service';
import { TicketStatus } from '../tickets/tickets.dto';
import {
  CreatePaymentDto,
  PaymentQueryDto,
  PaymentState,
  UpdatePaymentDto,
} from './payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private database: DatabaseService,
    private ticketsService: TicketsService,
  ) {}

  private async withTicketStatus(payment: PersistedPayment) {
    if (!payment.ticketId) {
      return {
        ...payment,
        ticketStatus: '',
      };
    }

    try {
      const ticket = await this.ticketsService.findOne(payment.ticketId);
      return {
        ...payment,
        ticketStatus: ticket.status,
      };
    } catch {
      return {
        ...payment,
        ticketStatus: '',
      };
    }
  }

  private nextPaymentId(payments: { id: string }[]) {
    const maxId = payments.reduce((max, payment) => {
      const value = parseInt(payment.id.replace(/^p/, ''), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `p${maxId + 1}`;
  }

  private nextClientId(payments: { clientId: string }[]) {
    const maxId = payments.reduce((max, payment) => {
      const value = parseInt((payment.clientId || '').replace(/^c/i, ''), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `c${maxId + 1}`;
  }

  private nextInvoice(payments: { invoice: string }[]) {
    const currentYear = new Date().getFullYear();
    const maxId = payments.reduce((max, payment) => {
      const value = parseInt((payment.invoice || '').split('-').pop() || '0', 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `INV-${currentYear}-${String(maxId + 1).padStart(5, '0')}`;
  }

  private nextReference(payments: { reference: string }[]) {
    const maxId = payments.reduce((max, payment) => {
      const value = parseInt((payment.reference || '').replace(/^REF-?/i, ''), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `REF-${String(maxId + 1).padStart(5, '0')}`;
  }

  async findAll(query: PaymentQueryDto) {
    let payments = [...(await this.database.getPayments())];

    if (query.search) {
      const q = query.search.toLowerCase();
      payments = payments.filter(
        (p) =>
          p.invoice.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          (p.reference && p.reference.toLowerCase().includes(q)),
      );
    }
    if (query.state) {
      payments = payments.filter((p) => p.state === query.state);
    }
    if (query.method) {
      payments = payments.filter((p) => p.method === query.method);
    }
    if (query.clientId) {
      payments = payments.filter((p) => p.clientId === query.clientId);
    }

    return {
      total: payments.length,
      data: await Promise.all(payments.map((payment) => this.withTicketStatus(payment))),
    };
  }

  async findOne(id: string) {
    const payments = await this.database.getPayments();
    const payment = payments.find((p) => p.id === id);
    if (!payment) throw new NotFoundException(`Paiement #${id} introuvable`);
    return this.withTicketStatus(payment);
  }

  async create(dto: CreatePaymentDto, clientName?: string) {
    const payments = await this.database.getPayments();
    const generatedClientId = dto.clientId?.trim() || this.nextClientId(payments);
    const createdAt = new Date().toISOString();
    const createdDate = createdAt.slice(0, 10);
    const newPayment: PersistedPayment = {
      id: this.nextPaymentId(payments),
      clientId: generatedClientId,
      client: dto.client || clientName || generatedClientId,
      planId: dto.planId || '',
      planName: dto.planName || '',
      invoice: this.nextInvoice(payments),
      method: dto.method,
      amount: dto.amount,
      reference: this.nextReference(payments),
      state: dto.state || PaymentState.COLLECTED,
      dueDate: createdDate,
      extension: '',
      notes: dto.notes || '',
      createdAt,
    };

    payments.push(newPayment);
    await this.database.savePayments(payments);

    const ticket = await this.ticketsService.createFromPayment(newPayment);
    newPayment.ticketId = ticket.id;
    newPayment.ticketNumber = ticket.ticketNumber;

    const persistedPayments = await this.database.getPayments();
    const index = persistedPayments.findIndex((payment) => payment.id === newPayment.id);
    persistedPayments[index] = newPayment;
    await this.database.savePayments(persistedPayments);

    this.logger.log(`Paiement créé: ${newPayment.invoice} pour ${newPayment.client}`);
    return this.withTicketStatus(newPayment);
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const payments = await this.database.getPayments();
    const idx = payments.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Paiement #${id} introuvable`);

    payments[idx] = { ...payments[idx], ...dto };
    await this.database.savePayments(payments);

    if (payments[idx].ticketId) {
      await this.ticketsService.update(payments[idx].ticketId, {
        clientId: payments[idx].clientId,
        client: payments[idx].client,
        invoice: payments[idx].invoice,
        amount: payments[idx].amount,
        title: `Paiement enregistre pour ${payments[idx].invoice}`,
        description: payments[idx].notes || 'Ticket mis a jour apres modification du paiement.',
      });
    }

    return this.withTicketStatus(payments[idx]);
  }

  async remove(id: string) {
    const payments = await this.database.getPayments();
    const idx = payments.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Paiement #${id} introuvable`);

    payments.splice(idx, 1);
    await this.database.savePayments(payments);
    await this.ticketsService.removeByPaymentId(id);
    return { message: `Paiement #${id} supprimé` };
  }

  async getDashboard() {
    const all = await this.database.getPayments();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyPayments = all.filter((p) => {
      const d = new Date(p.createdAt);
      return (
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        p.state === PaymentState.COLLECTED
      );
    });

    const monthlyRevenue = monthlyPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount || '0'),
      0,
    );

    const overdue = all.filter((p) => p.state === PaymentState.OVERDUE);
    const overdueAmount = overdue.reduce(
      (sum, p) => sum + parseFloat(p.amount || '0'),
      0,
    );

    const pending = all.filter((p) => p.state === PaymentState.PENDING);

    return {
      monthlyRevenue: `${monthlyRevenue.toLocaleString()} Ar`,
      monthlyRevenueRaw: monthlyRevenue,
      monthlyCount: monthlyPayments.length,
      overdueCount: overdue.length,
      overdueAmount: `${overdueAmount.toLocaleString()} Ar`,
      pendingCount: pending.length,
      recentTransactions: all
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
      overdueClients: overdue.map((p) => ({
        client: p.client,
        invoice: p.invoice,
        amount: p.amount,
        dueDate: p.dueDate,
      })),
    };
  }
}
