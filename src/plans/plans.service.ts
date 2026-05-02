import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RouterOSService } from '../routeros/routeros.service';
import { CreatePlanDto, UpdatePlanDto } from './plans.dto';

let SEED_PLANS = [
  {
    id: 'plan1',
    name: 'Fibre 5 Mbps',
    profileId: 'fiber-5mbps',
    price: 15000,
    priceWhole: '15 000',
    priceFraction: '',
    download: 5,
    upload: 2,
    downloadBar: '20%',
    uploadBar: '10%',
    quota: 'Illimité',
    quotaIcon: 'all_inclusive',
    validity: '30 jours',
    popular: false,
    description: 'Offre entrée de gamme',
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'plan2',
    name: 'Fibre 10 Mbps',
    profileId: 'fiber-10mbps',
    price: 25000,
    priceWhole: '25 000',
    priceFraction: '',
    download: 10,
    upload: 5,
    downloadBar: '40%',
    uploadBar: '25%',
    quota: 'Illimité',
    quotaIcon: 'all_inclusive',
    validity: '30 jours',
    popular: true,
    description: 'Offre la plus populaire',
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'plan3',
    name: 'Fibre 20 Mbps',
    profileId: 'fiber-20mbps',
    price: 45000,
    priceWhole: '45 000',
    priceFraction: '',
    download: 20,
    upload: 10,
    downloadBar: '60%',
    uploadBar: '50%',
    quota: 'Illimité',
    quotaIcon: 'all_inclusive',
    validity: '30 jours',
    popular: false,
    description: 'Idéal pour les familles',
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'plan4',
    name: 'Fibre 50 Mbps',
    profileId: 'fiber-50mbps',
    price: 95000,
    priceWhole: '95 000',
    priceFraction: '',
    download: 50,
    upload: 25,
    downloadBar: '85%',
    uploadBar: '70%',
    quota: 'Illimité',
    quotaIcon: 'all_inclusive',
    validity: '30 jours',
    popular: false,
    description: 'Offre premium entreprise',
    createdAt: new Date('2024-01-01').toISOString(),
  },
];

let idCounter = 5;

function buildUIPlan(plan: any) {
  return {
    ...plan,
    priceWhole: plan.price.toLocaleString('fr'),
    priceFraction: '',
    downloadBar: `${Math.min(Math.round((plan.download / 100) * 100), 100)}%`,
    uploadBar: `${Math.min(Math.round((plan.upload / 50) * 100), 100)}%`,
    quotaIcon: plan.quota === 'Illimité' ? 'all_inclusive' : 'data_usage',
  };
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private routeros: RouterOSService) {}

  async findAll() {
    return {
      total: SEED_PLANS.length,
      data: SEED_PLANS.map(buildUIPlan),
    };
  }

  async findOne(id: string) {
    const plan = SEED_PLANS.find((p) => p.id === id);
    if (!plan) throw new NotFoundException(`Plan #${id} introuvable`);
    return buildUIPlan(plan);
  }

  async create(dto: CreatePlanDto) {
    const exists = SEED_PLANS.find((p) => p.profileId === dto.profileId);
    if (exists)
      throw new ConflictException(`Profile ID '${dto.profileId}' déjà utilisé`);

    // Créer le profil PPPoE sur RouterOS
    try {
      const rateLimit = `${dto.download}M/${dto.upload}M`;
      await this.routeros.createPPPoEProfile({
        name: dto.profileId,
        'rate-limit': rateLimit,
        comment: dto.name,
      });
      this.logger.log(`Profil PPPoE créé sur RouterOS: ${dto.profileId} @ ${rateLimit}`);
    } catch (err: any) {
      this.logger.warn(`RouterOS non disponible, profil PPPoE non créé: ${err.message}`);
    }

    const newPlan = {
      id: `plan${idCounter++}`,
      name: dto.name,
      profileId: dto.profileId,
      price: dto.price,
      priceWhole: dto.price.toLocaleString('fr'),
      priceFraction: '',
      download: dto.download,
      upload: dto.upload,
      downloadBar: '',
      uploadBar: '',
      quota: dto.quota || 'Illimité',
      quotaIcon: dto.quota && dto.quota !== 'Illimité' ? 'data_usage' : 'all_inclusive',
      validity: dto.validity || '30 jours',
      popular: dto.popular || false,
      description: dto.description || '',
      createdAt: new Date().toISOString(),
    };

    SEED_PLANS.push(newPlan);
    return buildUIPlan(newPlan);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const idx = SEED_PLANS.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Plan #${id} introuvable`);

    const plan = SEED_PLANS[idx];

    // Mettre à jour le profil PPPoE sur RouterOS
    try {
      const roProfile = await this.routeros.getPPPoEProfileByName(plan.profileId);
      if (roProfile) {
        const updateData: any = {};
        if (dto.download || dto.upload) {
          const dl = dto.download || plan.download;
          const ul = dto.upload || plan.upload;
          updateData['rate-limit'] = `${dl}M/${ul}M`;
        }
        if (dto.name) updateData.comment = dto.name;

        if (Object.keys(updateData).length > 0) {
          await this.routeros.updatePPPoEProfile(roProfile['.id'], updateData);
          this.logger.log(`Profil PPPoE mis à jour sur RouterOS: ${plan.profileId}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`RouterOS sync échoué: ${err.message}`);
    }

    SEED_PLANS[idx] = { ...plan, ...dto };
    return buildUIPlan(SEED_PLANS[idx]);
  }

  async remove(id: string) {
    const idx = SEED_PLANS.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Plan #${id} introuvable`);

    const plan = SEED_PLANS[idx];

    // Supprimer le profil PPPoE sur RouterOS
    try {
      const roProfile = await this.routeros.getPPPoEProfileByName(plan.profileId);
      if (roProfile) {
        await this.routeros.deletePPPoEProfile(roProfile['.id']);
        this.logger.log(`Profil PPPoE supprimé sur RouterOS: ${plan.profileId}`);
      }
    } catch (err: any) {
      this.logger.warn(`RouterOS delete échoué: ${err.message}`);
    }

    SEED_PLANS.splice(idx, 1);
    return { message: `Plan #${id} supprimé` };
  }

  async syncFromRouterOS() {
    try {
      const profiles = await this.routeros.getPPPoEProfiles();
      this.logger.log(`${profiles.length} profils PPPoE récupérés depuis RouterOS`);
      return { synced: profiles.length, profiles };
    } catch (err: any) {
      this.logger.warn(`Sync RouterOS échoué: ${err.message}`);
      return { synced: 0, error: err.message };
    }
  }
}
