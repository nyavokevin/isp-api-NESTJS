import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PaymentMethod, PaymentState } from '../payments/payments.dto';

export type PersistedPlan = {
  id: string;
  name: string;
  type: string;
  profileId: string;
  price: number;
  download: number;
  upload: number;
  quota: string;
  validity: string;
  popular: boolean;
  description: string;
  createdAt: string;
};

export type PersistedPayment = {
  id: string;
  clientId: string;
  client: string;
  planId?: string;
  planName?: string;
  invoice: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
  state: PaymentState;
  dueDate: string;
  extension: string;
  notes: string;
  createdAt: string;
  ticketId?: string;
  ticketNumber?: string;
};

export type PersistedTicket = {
  id: string;
  ticketNumber: string;
  paymentId: string;
  clientId: string;
  client: string;
  invoice: string;
  amount: string;
  title: string;
  description: string;
  status: string;
  used?: boolean;
  usedAt?: string;
  usedByIp?: string;
  usedByMac?: string;
  createdAt: string;
  updatedAt: string;
};

export type PersistedClientHistory = {
  id: string;
  clientId: string;
  clientName: string;
  action: string;
  details: string;
  createdAt: string;
};

type StoreData = {
  plans: PersistedPlan[];
  payments: PersistedPayment[];
  tickets: PersistedTicket[];
  clientHistories: PersistedClientHistory[];
};

const DEFAULT_STORE: StoreData = {
  plans: [
    {
      id: 'plan1',
      name: 'Fibre 5 Mbps',
      type: 'Fiber',
      profileId: 'fiber-5mbps',
      price: 15000,
      download: 5,
      upload: 2,
      quota: 'Illimité',
      validity: '30 jours',
      popular: false,
      description: 'Offre entrée de gamme',
      createdAt: new Date('2024-01-01').toISOString(),
    },
    {
      id: 'plan2',
      name: 'Fibre 10 Mbps',
      type: 'Fiber',
      profileId: 'fiber-10mbps',
      price: 25000,
      download: 10,
      upload: 5,
      quota: 'Illimité',
      validity: '30 jours',
      popular: true,
      description: 'Offre la plus populaire',
      createdAt: new Date('2024-01-01').toISOString(),
    },
    {
      id: 'plan3',
      name: 'Fibre 20 Mbps',
      type: 'Fiber',
      profileId: 'fiber-20mbps',
      price: 45000,
      download: 20,
      upload: 10,
      quota: 'Illimité',
      validity: '30 jours',
      popular: false,
      description: 'Idéal pour les familles',
      createdAt: new Date('2024-01-01').toISOString(),
    },
    {
      id: 'plan4',
      name: 'Fibre 50 Mbps',
      type: 'Fiber',
      profileId: 'fiber-50mbps',
      price: 95000,
      download: 50,
      upload: 25,
      quota: 'Illimité',
      validity: '30 jours',
      popular: false,
      description: 'Offre premium entreprise',
      createdAt: new Date('2024-01-01').toISOString(),
    },
  ],
  payments: [
    {
      id: 'p1',
      clientId: 'c1',
      client: 'Jean Rakoto',
      planId: 'plan2',
      planName: 'Fibre 10 Mbps',
      invoice: 'INV-2025-001',
      method: PaymentMethod.MVOLA,
      amount: '25000',
      reference: 'REF-00001',
      state: PaymentState.COLLECTED,
      dueDate: '2025-01-05',
      extension: '',
      notes: '',
      createdAt: new Date('2025-01-05').toISOString(),
      ticketId: 't1',
      ticketNumber: 'TCK-2025-00001',
    },
    {
      id: 'p2',
      clientId: 'c2',
      client: 'Marie Razafy',
      planId: 'plan3',
      planName: 'Fibre 20 Mbps',
      invoice: 'INV-2025-002',
      method: PaymentMethod.CASH,
      amount: '45000',
      reference: 'REF-00002',
      state: PaymentState.COLLECTED,
      dueDate: '2025-02-03',
      extension: '',
      notes: '',
      createdAt: new Date('2025-02-03').toISOString(),
      ticketId: 't2',
      ticketNumber: 'TCK-2025-00002',
    },
    {
      id: 'p3',
      clientId: 'c3',
      client: 'Paul Randria',
      planId: 'plan1',
      planName: 'Fibre 5 Mbps',
      invoice: 'INV-2025-003',
      method: PaymentMethod.ORANGE_MONEY,
      amount: '15000',
      reference: 'REF-00003',
      state: PaymentState.OVERDUE,
      dueDate: '2025-03-01',
      extension: '',
      notes: 'Client non joignable',
      createdAt: new Date('2025-03-01').toISOString(),
      ticketId: 't3',
      ticketNumber: 'TCK-2025-00003',
    },
    {
      id: 'p4',
      clientId: 'c4',
      client: 'Haja Rasolofo',
      planId: 'plan4',
      planName: 'Fibre 50 Mbps',
      invoice: 'INV-2025-004',
      method: PaymentMethod.BANK_TRANSFER,
      amount: '95000',
      reference: 'REF-00004',
      state: PaymentState.COLLECTED,
      dueDate: '2025-04-02',
      extension: '',
      notes: '',
      createdAt: new Date('2025-04-02').toISOString(),
      ticketId: 't4',
      ticketNumber: 'TCK-2025-00004',
    },
    {
      id: 'p5',
      clientId: 'c5',
      client: 'Soa Andriantsoa',
      planId: 'plan2',
      planName: 'Fibre 10 Mbps',
      invoice: 'INV-2025-005',
      method: PaymentMethod.AIRTEL_MONEY,
      amount: '25000',
      reference: 'REF-00005',
      state: PaymentState.PENDING,
      dueDate: '2025-05-01',
      extension: '',
      notes: 'En attente de confirmation',
      createdAt: new Date('2025-05-01').toISOString(),
      ticketId: 't5',
      ticketNumber: 'TCK-2025-00005',
    },
  ],
  tickets: [
    {
      id: 't1',
      ticketNumber: 'TCK-2025-00001',
      paymentId: 'p1',
      clientId: 'c1',
      client: 'Jean Rakoto',
      invoice: 'INV-2025-001',
      amount: '25000',
      title: 'Paiement enregistre pour INV-2025-001',
      description: 'Ticket genere automatiquement apres paiement.',
      status: 'Open',
      used: false,
      createdAt: new Date('2025-01-05').toISOString(),
      updatedAt: new Date('2025-01-05').toISOString(),
    },
    {
      id: 't2',
      ticketNumber: 'TCK-2025-00002',
      paymentId: 'p2',
      clientId: 'c2',
      client: 'Marie Razafy',
      invoice: 'INV-2025-002',
      amount: '45000',
      title: 'Paiement enregistre pour INV-2025-002',
      description: 'Ticket genere automatiquement apres paiement.',
      status: 'Resolved',
      used: false,
      createdAt: new Date('2025-02-03').toISOString(),
      updatedAt: new Date('2025-02-04').toISOString(),
    },
    {
      id: 't3',
      ticketNumber: 'TCK-2025-00003',
      paymentId: 'p3',
      clientId: 'c3',
      client: 'Paul Randria',
      invoice: 'INV-2025-003',
      amount: '15000',
      title: 'Paiement enregistre pour INV-2025-003',
      description: 'Ticket genere automatiquement apres paiement.',
      status: 'Open',
      used: false,
      createdAt: new Date('2025-03-01').toISOString(),
      updatedAt: new Date('2025-03-01').toISOString(),
    },
    {
      id: 't4',
      ticketNumber: 'TCK-2025-00004',
      paymentId: 'p4',
      clientId: 'c4',
      client: 'Haja Rasolofo',
      invoice: 'INV-2025-004',
      amount: '95000',
      title: 'Paiement enregistre pour INV-2025-004',
      description: 'Ticket genere automatiquement apres paiement.',
      status: 'Resolved',
      used: false,
      createdAt: new Date('2025-04-02').toISOString(),
      updatedAt: new Date('2025-04-02').toISOString(),
    },
    {
      id: 't5',
      ticketNumber: 'TCK-2025-00005',
      paymentId: 'p5',
      clientId: 'c5',
      client: 'Soa Andriantsoa',
      invoice: 'INV-2025-005',
      amount: '25000',
      title: 'Paiement enregistre pour INV-2025-005',
      description: 'Ticket genere automatiquement apres paiement.',
      status: 'In Progress',
      used: false,
      createdAt: new Date('2025-05-01').toISOString(),
      updatedAt: new Date('2025-05-02').toISOString(),
    },
  ],
  clientHistories: [],
};

@Injectable()
export class DatabaseService {
  private readonly storePath = join(process.cwd(), 'data', 'app-db.json');
  private readonly ready = this.ensureStore();

  private async ensureStore() {
    await mkdir(dirname(this.storePath), { recursive: true });

    try {
      await readFile(this.storePath, 'utf-8');
    } catch {
      await writeFile(this.storePath, JSON.stringify(DEFAULT_STORE, null, 2), 'utf-8');
    }
  }

  private async readStore(): Promise<StoreData> {
    await this.ready;
    const raw = await readFile(this.storePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;

    return {
      plans: Array.isArray(parsed.plans) ? parsed.plans : DEFAULT_STORE.plans,
      payments: Array.isArray(parsed.payments) ? parsed.payments : DEFAULT_STORE.payments,
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : DEFAULT_STORE.tickets,
      clientHistories: Array.isArray(parsed.clientHistories)
        ? parsed.clientHistories
        : DEFAULT_STORE.clientHistories,
    };
  }

  private async writeStore(store: StoreData) {
    await this.ready;
    await writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  async getPayments() {
    const store = await this.readStore();
    return store.payments;
  }

  async getPlans() {
    const store = await this.readStore();
    return store.plans;
  }

  async savePlans(plans: PersistedPlan[]) {
    const store = await this.readStore();
    store.plans = plans;
    await this.writeStore(store);
  }

  async savePayments(payments: PersistedPayment[]) {
    const store = await this.readStore();
    store.payments = payments;
    await this.writeStore(store);
  }

  async getTickets() {
    const store = await this.readStore();
    return store.tickets;
  }

  async saveTickets(tickets: PersistedTicket[]) {
    const store = await this.readStore();
    store.tickets = tickets;
    await this.writeStore(store);
  }

  async getClientHistories() {
    const store = await this.readStore();
    return store.clientHistories;
  }

  async saveClientHistories(clientHistories: PersistedClientHistory[]) {
    const store = await this.readStore();
    store.clientHistories = clientHistories;
    await this.writeStore(store);
  }
}