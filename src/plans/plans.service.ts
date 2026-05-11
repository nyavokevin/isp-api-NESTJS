import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService, PersistedPlan } from '../database/database.service';
import { RouterOSService } from '../routeros/routeros.service';
import { CreatePlanDto, UpdatePlanDto } from './plans.dto';

function buildUIPlan(plan: PersistedPlan) {
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

  constructor(
    private routeros: RouterOSService,
    private database: DatabaseService,
  ) {}

  private nextPlanId(plans: { id: string }[]) {
    const maxId = plans.reduce((max, plan) => {
      const value = parseInt(plan.id.replace(/^plan/i, ''), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);

    return `plan${maxId + 1}`;
  }

  private slugifyProfileId(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private resolveProfileId(plans: PersistedPlan[], requestedProfileId: string | undefined, name: string) {
    const normalizedRequested = String(requestedProfileId || '').trim();

    if (normalizedRequested) {
      return normalizedRequested;
    }

    const base = this.slugifyProfileId(name) || 'plan-profile';
    let candidate = base;
    let suffix = 2;

    while (plans.some((plan) => plan.profileId === candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  async findById(id: string) {
    const plans = await this.database.getPlans();
    return plans.find((plan) => plan.id === id) || null;
  }

  async findByProfileId(profileId: string) {
    const plans = await this.database.getPlans();
    return plans.find((plan) => plan.profileId === profileId) || null;
  }

  async findAll() {
    const plans = await this.database.getPlans();
    return {
      total: plans.length,
      data: plans.map(buildUIPlan),
    };
  }

  async findOne(id: string) {
    const plans = await this.database.getPlans();
    const plan = plans.find((p) => p.id === id);
    if (!plan) throw new NotFoundException(`Plan #${id} introuvable`);
    return buildUIPlan(plan);
  }

  async create(dto: CreatePlanDto) {
    const plans = await this.database.getPlans();
    const profileId = this.resolveProfileId(plans, dto.profileId, dto.name);
    const exists = plans.find((p) => p.profileId === profileId);
    if (exists)
      throw new ConflictException(`Profile ID '${profileId}' déjà utilisé`);

    // Créer le profil PPPoE sur RouterOS
    try {
      const rateLimit = `${dto.download}M/${dto.upload}M`;
      await this.routeros.createPPPoEProfile({
        name: profileId,
        'rate-limit': rateLimit,
        comment: dto.name,
      });
      this.logger.log(`Profil PPPoE créé sur RouterOS: ${profileId} @ ${rateLimit}`);
    } catch (err: any) {
      this.logger.warn(`RouterOS non disponible, profil PPPoE non créé: ${err.message}`);
    }

    const newPlan: PersistedPlan = {
      id: this.nextPlanId(plans),
      name: dto.name,
      type: dto.type || 'Fiber',
      profileId,
      price: dto.price,
      download: dto.download,
      upload: dto.upload,
      quota: dto.quota || 'Illimité',
      validity: dto.validity || '30 jours',
      popular: dto.popular || false,
      description: dto.description || '',
      createdAt: new Date().toISOString(),
    };

    plans.push(newPlan);
    await this.database.savePlans(plans);
    return buildUIPlan(newPlan);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plans = await this.database.getPlans();
    const idx = plans.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Plan #${id} introuvable`);

    const plan = plans[idx];
    const requestedProfileId = String(dto.profileId || '').trim();
    const nextProfileId = requestedProfileId || plan.profileId;

    if (nextProfileId !== plan.profileId) {
      const duplicate = plans.find((item) => item.id !== id && item.profileId === nextProfileId);
      if (duplicate) {
        throw new ConflictException(`Profile ID '${nextProfileId}' déjà utilisé`);
      }
    }

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
        if (nextProfileId !== plan.profileId) updateData.name = nextProfileId;

        if (Object.keys(updateData).length > 0) {
          await this.routeros.updatePPPoEProfile(roProfile['.id'], updateData);
          this.logger.log(`Profil PPPoE mis à jour sur RouterOS: ${nextProfileId}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`RouterOS sync échoué: ${err.message}`);
    }

    plans[idx] = { ...plan, ...dto, profileId: nextProfileId };
    await this.database.savePlans(plans);
    return buildUIPlan(plans[idx]);
  }

  async remove(id: string) {
    const plans = await this.database.getPlans();
    const idx = plans.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException(`Plan #${id} introuvable`);

    const plan = plans[idx];

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

    plans.splice(idx, 1);
    await this.database.savePlans(plans);
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
