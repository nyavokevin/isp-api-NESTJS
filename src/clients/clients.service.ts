import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RouterOSService } from '../routeros/routeros.service';
import { ClientQueryDto, ClientStatus, CreateClientDto, UpdateClientDto } from './clients.dto';

// Seed data – remplacé par RouterOS en production
let SEED_CLIENTS = [
  {
    id: 'c1',
    name: 'Jean Rakoto',
    phone: '+261340000001',
    address: 'Lot II J 45 Antananarivo',
    pppoeLogin: 'jean.rakoto',
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
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private routeros: RouterOSService) {}

  async findAll(query: ClientQueryDto) {
    let clients = [...SEED_CLIENTS];

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

    return {
      total: clients.length,
      data: clients,
    };
  }

  async findOne(id: string) {
    const client = SEED_CLIENTS.find((c) => c.id === id);
    if (!client) throw new NotFoundException(`Client #${id} introuvable`);
    return client;
  }

  async findByPPPoELogin(login: string) {
    const client = SEED_CLIENTS.find((c) => c.pppoeLogin === login);
    if (!client)
      throw new NotFoundException(`Client avec login PPPoE '${login}' introuvable`);
    return client;
  }

  async create(dto: CreateClientDto) {
    // Vérifier unicité du login PPPoE
    const exists = SEED_CLIENTS.find((c) => c.pppoeLogin === dto.pppoeLogin);
    if (exists)
      throw new ConflictException(`Login PPPoE '${dto.pppoeLogin}' déjà utilisé`);

    // Créer le secret PPPoE sur RouterOS
    try {
      await this.routeros.createPPPoESecret({
        name: dto.pppoeLogin,
        password: dto.pppoePassword,
        profile: dto.plan,
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
      plan: dto.plan,
      status: dto.status || ClientStatus.ACTIVE,
      expiration: dto.expiration,
      area: dto.area,
      balance: dto.balance || '0',
      notes: dto.notes || '',
      createdAt: new Date().toISOString(),
    };

    SEED_CLIENTS.push(newClient);
    return newClient;
  }

  async update(id: string, dto: UpdateClientDto) {
    const idx = SEED_CLIENTS.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Client #${id} introuvable`);

    const client = SEED_CLIENTS[idx];

    // Synchroniser sur RouterOS si profil ou statut changé
    try {
      const secret = await this.routeros.getPPPoESecretByName(client.pppoeLogin);
      if (secret) {
        const updateData: any = {};
        if (dto.plan) updateData.profile = dto.plan;
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

    SEED_CLIENTS[idx] = { ...client, ...dto };
    return SEED_CLIENTS[idx];
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
