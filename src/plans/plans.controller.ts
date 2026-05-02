import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './plans.dto';

@ApiTags('Plans')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Catalogue des plans reseau' })
  findAll() {
    return this.plansService.findAll();
  }

  @Get('sync-routeros')
  @ApiOperation({ summary: 'Synchroniser les profils depuis RouterOS' })
  syncFromRouterOS() {
    return this.plansService.syncFromRouterOS();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail plan' })
  @ApiParam({ name: 'id', description: 'ID du plan' })
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Creer un plan + profil PPPoE sur RouterOS' })
  @ApiResponse({ status: 201, description: 'Plan cree' })
  @ApiResponse({ status: 409, description: 'Profile ID deja utilise' })
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un plan (sync RouterOS)' })
  @ApiParam({ name: 'id', description: 'ID du plan' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un plan + profil PPPoE RouterOS' })
  @ApiParam({ name: 'id', description: 'ID du plan' })
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
