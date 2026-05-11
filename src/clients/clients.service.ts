import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService, PersistedClientHistory } from '../database/database.service';
import { PlansService } from '../plans/plans.service';
import { RouterOSService } from '../routeros/routeros.service';
import { TicketStatus } from '../tickets/tickets.dto';
import { ClientQueryDto, ClientStatus, CreateClientDto, UpdateClientDto } from './clients.dto';

// Seed data – remplacé par RouterOS en production
let SEED_CLIENTS = [
  {
    id: 'c1',
    name: 'Jean Rakoto',
    phone: '+261340000001',
    address: 'Lot II J 45 Antananarivo',
    pppoeLogin: 'jean.rakoto',
    planId: 'plan2',
    plan: 'fiber-10mbps',
    status: ClientStatus.ACTIVE,
    expiration: '2025-12-31',
    area: 'Antananarivo Centre',
    balance: '5000',
    notes: '',
    createdAt: new Date('2024-01-10').toISOString(),
  },
  {
    id: 'c2',
    name: 'Marie Razafy',
    phone: '+261340000002',
    address: 'Cité Andohalo B12 Antananarivo',
    pppoeLogin: 'marie.razafy',
    planId: 'plan3',
    plan: 'fiber-20mbps',
    status: ClientStatus.ACTIVE,
    expiration: '2025-11-30',
    area: 'Antananarivo Nord',
    balance: '0',
    notes: '',
    createdAt: new Date('2024-02-15').toISOString(),
  },
  {
    id: 'c3',
    name: 'Paul Randria',
    phone: '+261340000003',
    address: 'Ankadifotsy Rue 18 Antananarivo',
    pppoeLogin: 'paul.randria',
    planId: 'plan1',
    plan: 'fiber-5mbps',
    status: ClientStatus.SUSPENDED,
    expiration: '2025-09-15',
    area: 'Antananarivo Sud',
    balance: '-15000',
    notes: 'Paiement en retard',
    createdAt: new Date('2024-03-01').toISOString(),
  },
  {
    id: 'c4',
    name: 'Haja Rasolofo',
    phone: '+261340000004',
    address: 'Ivandry Villa 7 Antananarivo',
    pppoeLogin: 'haja.rasolofo',
    planId: 'plan4',
    plan: 'fiber-50mbps',
    status: ClientStatus.ACTIVE,
    expiration: '2026-01-31',
    area: 'Ivandry',
    balance: '20000',
    notes: '',
    createdAt: new Date('2024-04-20').toISOString(),
  },
  {
    id: 'c5',
    name: 'Soa Andriantsoa',
    phone: '+261340000005',
    address: 'Mahamasina Rue 5 Antananarivo',
    pppoeLogin: 'soa.andriantsoa',
    planId: 'plan2',
    plan: 'fiber-10mbps',
    status: ClientStatus.EXPIRED,
    expiration: '2024-08-01',
    area: 'Mahamasina',
    balance: '-30000',
    notes: 'Contrat expiré',
    createdAt: new Date('2024-01-05').toISOString(),
  },
];

let idCounter = 6;

@Injectable()
export class ClientsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientsService.name);
  private enforcementTimer: NodeJS.Timeout | null = null;

  constructor(
    private routeros: RouterOSService,
    private plansService: PlansService,
    private database: DatabaseService,
  ) {}

  onModuleInit() {
    void this.enforcePlanValidityForHotspotSessions();
    this.enforcementTimer = setInterval(() => {
      void this.enforcePlanValidityForHotspotSessions();
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.enforcementTimer) {
      clearInterval(this.enforcementTimer);
      this.enforcementTimer = null;
    }
  }

  private async enrichClient(client: any) {
    const linkedPlan = client.planId
      ? await this.plansService.findById(client.planId)
      : await this.plansService.findByProfileId(client.plan);

    return {
      ...client,
      planId: client.planId || linkedPlan?.id || '',
      planName: linkedPlan?.name || client.plan,
    };
  }

  private parseDurationToMilliseconds(value: string) {
    const normalized = String(value || '').toLowerCase();
    const patterns: Array<[RegExp, number]> = [
      [/(\d+)\s*w/g, 7 * 24 * 60 * 60 * 1000],
      [/(\d+)\s*(jour|jours|day|days|d)/g, 24 * 60 * 60 * 1000],
      [/(\d+)\s*(heure|heures|hour|hours|h)/g, 60 * 60 * 1000],
      [/(\d+)\s*(minute|minutes|min|m)/g, 60 * 1000],
      [/(\d+)\s*(second|seconds|sec|s)/g, 1000],
    ];

    let total = 0;

    for (const [pattern, unit] of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalized)) !== null) {
        total += Number(match[1]) * unit;
      }
    }

    return total;
  }

  private nextHistoryId(histories: { id: string }[]) {
    const maxId = histories.reduce((max, entry) => {
      const value = parseInt(entry.id.replace(/^h/i, ''), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `h${maxId + 1}`;
  }

  private async appendHistory(client: { id: string; name: string }, action: string, details: string) {
    const histories = await this.database.getClientHistories();
    const entry: PersistedClientHistory = {
      id: this.nextHistoryId(histories),
      clientId: client.id,
      clientName: client.name,
      action,
      details,
      createdAt: new Date().toISOString(),
    };

    histories.unshift(entry);
    await this.database.saveClientHistories(histories.slice(0, 200));
    return entry;
  }

  async getHistory(limit = 20) {
    const histories = await this.database.getClientHistories();
    return histories
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  private async resolveHotspotPlanForUsername(username: string) {
    const matchingClient = SEED_CLIENTS.find((client) => client.pppoeLogin === username);

    if (matchingClient?.planId) {
      const clientPlan = await this.plansService.findById(matchingClient.planId);
      if (clientPlan) {
        return {
          plan: clientPlan,
          source: 'client',
        };
      }
    }

    const tickets = await this.database.getTickets();
    const ticket = tickets.find(
      (item) => item.ticketNumber.toLowerCase() === username.toLowerCase(),
    );

    if (!ticket?.paymentId) {
      return null;
    }

    const payments = await this.database.getPayments();
    const payment = payments.find((item) => item.id === ticket.paymentId);

    if (!payment?.planId) {
      return null;
    }

    const paymentPlan = await this.plansService.findById(payment.planId);

    if (!paymentPlan) {
      return null;
    }

    return {
      plan: paymentPlan,
      ticket,
      payment,
      source: 'ticket',
    };
  }

  private async enforcePlanValidityForHotspotSessions() {
    try {
      const sessions = await this.routeros.getActiveHotspotSessions();

      for (const session of sessions) {
        const username = session.user || session.name || '';
        const planContext = await this.resolveHotspotPlanForUsername(username);

        if (!planContext?.plan) {
          continue;
        }

        const allowedDuration = this.parseDurationToMilliseconds(planContext.plan.validity || '');
        const currentUptime = this.parseDurationToMilliseconds(session.uptime || '');

        if (!allowedDuration || currentUptime < allowedDuration) {
          continue;
        }

        const sessionId = String(session['.id'] || session.id || session['#'] || '');

        if (!sessionId) {
          continue;
        }

        await this.routeros.disconnectHotspotSession(sessionId);
        const hotspotUser = await this.routeros.getHotspotUserByName(username);
        const hotspotUserId = hotspotUser?.['.id'] || hotspotUser?.id || hotspotUser?.['#'];

        if (hotspotUserId) {
          await this.routeros.deleteHotspotUser(hotspotUserId);
        }

        if (planContext.ticket) {
          const tickets = await this.database.getTickets();
          const ticketIndex = tickets.findIndex((item) => item.id === planContext.ticket.id);

          if (ticketIndex !== -1) {
            tickets[ticketIndex] = {
              ...tickets[ticketIndex],
              status: TicketStatus.EXPIRED,
              used: true,
              updatedAt: new Date().toISOString(),
            } as any;
            await this.database.saveTickets(tickets);
          }
        }

        await this.appendHistory(
          { id: planContext.ticket?.clientId || username, name: planContext.ticket?.client || username },
          'Auto disconnect',
          `Session ${username} disconnected after reaching plan validity ${planContext.plan.validity}`,
        );

        this.logger.log(
          `Hotspot session ${sessionId} disconnected because ${username} reached plan validity ${planContext.plan.validity || ''}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Plan validity enforcement skipped: ${error.message}`);
    }
  }

  async findAll(query: ClientQueryDto) {
    let clients = await Promise.all(SEED_CLIENTS.map((client) => this.enrichClient(client)));

    if (query.search) {
      const q = query.search.toLowerCase();
      clients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.pppoeLogin.toLowerCase().includes(q) ||
          c.phone.includes(q),
      );
    }
    if (query.status) {
      clients = clients.filter((c) => c.status === query.status);
    }
    if (query.area) {
      clients = clients.filter((c) =>
        c.area.toLowerCase().includes(query.area.toLowerCase()),
      );
    }
    if (query.plan) {
      clients = clients.filter((c) =>
        c.plan.toLowerCase().includes(query.plan.toLowerCase()),
      );
    }

    if (query.planId) {
      clients = clients.filter((c) => c.planId === query.planId);
    }

    return {
      total: clients.length,
      data: clients,
    };
  }

  async findOne(id: string) {
    const client = SEED_CLIENTS.find((c) => c.id === id);
    if (!client) throw new NotFoundException(`Client #${id} introuvable`);
    return this.enrichClient(client);
  }

  async findByPPPoELogin(login: string) {
    const client = SEED_CLIENTS.find((c) => c.pppoeLogin === login);
    if (!client)
      throw new NotFoundException(`Client avec login PPPoE '${login}' introuvable`);
    return this.enrichClient(client);
  }

  async create(dto: CreateClientDto) {
    // Vérifier unicité du login PPPoE
    const exists = SEED_CLIENTS.find((c) => c.pppoeLogin === dto.pppoeLogin);
    if (exists)
      throw new ConflictException(`Login PPPoE '${dto.pppoeLogin}' déjà utilisé`);

    const linkedPlan = dto.planId
      ? await this.plansService.findById(dto.planId)
      : await this.plansService.findByProfileId(dto.plan);

    // Créer le secret PPPoE sur RouterOS
    try {
      await this.routeros.createPPPoESecret({
        name: dto.pppoeLogin,
        password: dto.pppoePassword,
        profile: linkedPlan?.profileId || dto.plan,
        comment: dto.notes || dto.name,
      });
      this.logger.log(`Secret PPPoE créé sur RouterOS: ${dto.pppoeLogin}`);
    } catch (err: any) {
      this.logger.warn(`RouterOS non disponible, secret PPPoE non créé: ${err.message}`);
    }

    const newClient = {
      id: `c${idCounter++}`,
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
      pppoeLogin: dto.pppoeLogin,
      planId: linkedPlan?.id || dto.planId || '',
      plan: linkedPlan?.profileId || dto.plan,
      status: dto.status || ClientStatus.ACTIVE,
      expiration: dto.expiration,
      area: dto.area,
      balance: dto.balance || '0',
      notes: dto.notes || '',
      createdAt: new Date().toISOString(),
    };

    SEED_CLIENTS.push(newClient);
    await this.appendHistory(newClient, 'Create', `Client created with plan ${newClient.plan}`);
    return this.enrichClient(newClient);
  }

  async update(id: string, dto: UpdateClientDto) {
    const idx = SEED_CLIENTS.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Client #${id} introuvable`);

    const client = SEED_CLIENTS[idx];
    const nextPlan = dto.planId
      ? await this.plansService.findById(dto.planId)
      : dto.plan
        ? await this.plansService.findByProfileId(dto.plan)
        : client.planId
          ? await this.plansService.findById(client.planId)
          : await this.plansService.findByProfileId(client.plan);

    // Synchroniser sur RouterOS si profil ou statut changé
    try {
      const secret = await this.routeros.getPPPoESecretByName(client.pppoeLogin);
      if (secret) {
        const updateData: any = {};
        if (dto.plan || dto.planId) updateData.profile = nextPlan?.profileId || dto.plan;
        if (dto.pppoePassword) updateData.password = dto.pppoePassword;
        if (dto.status === ClientStatus.SUSPENDED) updateData.disabled = true;
        if (dto.status === ClientStatus.ACTIVE) updateData.disabled = false;
        if (dto.notes) updateData.comment = dto.notes;

        if (Object.keys(updateData).length > 0) {
          await this.routeros.updatePPPoESecret(secret['.id'], updateData);
          this.logger.log(`RouterOS secret mis à jour: ${client.pppoeLogin}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`RouterOS sync échoué: ${err.message}`);
    }

    SEED_CLIENTS[idx] = {
      ...client,
      ...dto,
      planId: nextPlan?.id || dto.planId || client.planId || '',
      plan: nextPlan?.profileId || dto.plan || client.plan,
    };
    await this.appendHistory(
      SEED_CLIENTS[idx],
      'Update',
      `Client updated. Status: ${SEED_CLIENTS[idx].status}. Plan: ${SEED_CLIENTS[idx].plan}`,
    );
    return this.enrichClient(SEED_CLIENTS[idx]);
  }

  async remove(id: string) {
    const idx = SEED_CLIENTS.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Client #${id} introuvable`);

    const client = SEED_CLIENTS[idx];

    // Supprimer sur RouterOS
    try {
      const secret = await this.routeros.getPPPoESecretByName(client.pppoeLogin);
      if (secret) {
        await this.routeros.deletePPPoESecret(secret['.id']);
        this.logger.log(`Secret PPPoE supprimé sur RouterOS: ${client.pppoeLogin}`);
      }
    } catch (err: any) {
      this.logger.warn(`RouterOS delete échoué: ${err.message}`);
    }

    await this.appendHistory(client, 'Delete', 'Client removed from the system');
    SEED_CLIENTS.splice(idx, 1);
    return { message: `Client #${id} supprimé` };
  }

  async suspend(id: string) {
    return this.update(id, { status: ClientStatus.SUSPENDED });
  }

  async activate(id: string) {
    return this.update(id, { status: ClientStatus.ACTIVE });
  }

  async getStats() {
    const total = SEED_CLIENTS.length;
    const active = SEED_CLIENTS.filter((c) => c.status === ClientStatus.ACTIVE).length;
    const suspended = SEED_CLIENTS.filter((c) => c.status === ClientStatus.SUSPENDED).length;
    const expired = SEED_CLIENTS.filter((c) => c.status === ClientStatus.EXPIRED).length;
    const inactive = SEED_CLIENTS.filter((c) => c.status === ClientStatus.INACTIVE).length;

    const totalBalance = SEED_CLIENTS.reduce(
      (sum, c) => sum + parseFloat(c.balance || '0'),
      0,
    );

    return {
      total,
      active,
      suspended,
      expired,
      inactive,
      totalBalance: `${totalBalance.toLocaleString()} Ar`,
    };
  }
}
