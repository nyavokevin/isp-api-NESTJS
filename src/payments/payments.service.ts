import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePaymentDto,
  PaymentMethod,
  PaymentQueryDto,
  PaymentState,
  UpdatePaymentDto,
} from './payments.dto';

let SEED_PAYMENTS = [
  {
    id: 'p1',
    clientId: 'c1',
    client: 'Jean Rakoto',
    invoice: 'INV-2025-001',
    method: PaymentMethod.MVOLA,
    amount: '25000',
    reference: 'MV-20250101',
    state: PaymentState.COLLECTED,
    dueDate: '2025-01-31',
    extension: '30 jours',
    notes: '',
    createdAt: new Date('2025-01-05').toISOString(),
  },
  {
    id: 'p2',
    clientId: 'c2',
    client: 'Marie Razafy',
    invoice: 'INV-2025-002',
    method: PaymentMethod.CASH,
    amount: '45000',
    reference: 'CASH-002',
    state: PaymentState.COLLECTED,
    dueDate: '2025-02-28',
    extension: '30 jours',
    notes: '',
    createdAt: new Date('2025-02-03').toISOString(),
  },
  {
    id: 'p3',
    clientId: 'c3',
    client: 'Paul Randria',
    invoice: 'INV-2025-003',
    method: PaymentMethod.ORANGE_MONEY,
    amount: '15000',
    reference: '',
    state: PaymentState.OVERDUE,
    dueDate: '2025-03-15',
    extension: '',
    notes: 'Client non joignable',
    createdAt: new Date('2025-03-01').toISOString(),
  },
  {
    id: 'p4',
    clientId: 'c4',
    client: 'Haja Rasolofo',
    invoice: 'INV-2025-004',
    method: PaymentMethod.BANK_TRANSFER,
    amount: '95000',
    reference: 'VIR-20250401',
    state: PaymentState.COLLECTED,
    dueDate: '2025-04-30',
    extension: '30 jours',
    notes: '',
    createdAt: new Date('2025-04-02').toISOString(),
  },
  {
    id: 'p5',
    clientId: 'c5',
    client: 'Soa Andriantsoa',
    invoice: 'INV-2025-005',
    method: PaymentMethod.AIRTEL_MONEY,
    amount: '25000',
    reference: '',
    state: PaymentState.PENDING,
    dueDate: '2025-05-31',
    extension: '',
    notes: 'En attente de confirmation',
    createdAt: new Date('2025-05-01').toISOString(),
  },
];

let idCounter = 6;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  async findAll(query: PaymentQueryDto) {
    let payments = [...SEED_PAYMENTS];

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
      data: payments,
    };
  }

  async findOne(id: string) {
    const payment = SEED_PAYMENTS.find((p) => p.id === id);
    if (!payment) throw new NotFoundException(`Paiement #${id} introuvable`);
    return payment;
  }

  async create(dto: CreatePaymentDto, clientName?: string) {
    const newPayment = {
      id: `p${idCounter++}`,
      clientId: dto.clientId,
      client: clientName || dto.clientId,
      invoice: dto.invoice,
      method: dto.method,
      amount: dto.amount,
      reference: dto.reference || '',
      state: dto.state || PaymentState.COLLECTED,
      dueDate: dto.dueDate,
      extension: dto.extension || '',
      notes: dto.notes || '',
      createdAt: new Date().toISOString(),
    };

    SEED_PAYMENTS.push(newPayment);
    this.logger.log(`Paiement créé: ${newPayment.invoice} pour ${newPayment.client}`);
    return newPayment;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const idx = SEED_PAYMENTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Paiement #${id} introuvable`);

    SEED_PAYMENTS[idx] = { ...SEED_PAYMENTS[idx], ...dto };
    return SEED_PAYMENTS[idx];
  }

  async remove(id: string) {
    const idx = SEED_PAYMENTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Paiement #${id} introuvable`);
    SEED_PAYMENTS.splice(idx, 1);
    return { message: `Paiement #${id} supprimé` };
  }

  async getDashboard() {
    const all = SEED_PAYMENTS;
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
