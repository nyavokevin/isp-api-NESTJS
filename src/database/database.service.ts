import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PaymentMethod, PaymentState } from '../payments/payments.dto';

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

type StoreData = {
  payments: PersistedPayment[];
  tickets: PersistedTicket[];
};

const DEFAULT_STORE: StoreData = {
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
    return JSON.parse(raw) as StoreData;
  }

  private async writeStore(store: StoreData) {
    await this.ready;
    await writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  async getPayments() {
    const store = await this.readStore();
    return store.payments;
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
}