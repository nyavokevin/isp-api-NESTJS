import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MonitoringService } from './monitoring.service';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class PingDto {
  @ApiProperty({ example: '192.168.88.1' })
  @IsString()
  address: string;
}

@ApiTags('Monitoring')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('monitoring')
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard monitoring complet (santé, sessions, logs)' })
  getDashboard() {
    return this.monitoringService.getFullDashboard();
  }

  @Get('dashboard-summary')
  @ApiOperation({ summary: 'Dashboard metier clients, tickets, paiements et historique' })
  getDashboardSummary() {
    return this.monitoringService.getDashboardSummary();
  }

  @Get('users/current-speed')
  @ApiOperation({ summary: 'Consommation internet courante par utilisateur connecté' })
  getCurrentUserSpeed() {
    return this.monitoringService.getCurrentUserInternetUsage();
  }

  @Get('system')
  @ApiOperation({ summary: 'Santé système RouterOS (CPU, RAM, uptime)' })
  getSystemHealth() {
    return this.monitoringService.getSystemHealth();
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Sessions PPPoE actives' })
  getSessions() {
    return this.monitoringService.getPPPoESessions();
  }

  @Get('hotspot/connected')
  @ApiOperation({ summary: 'Clients hotspot connectés avec nom de l appareil' })
  getHotspotConnectedDevices() {
    return this.monitoringService.getHotspotConnectedDevices();
  }

  @Get('interfaces')
  @ApiOperation({ summary: 'Interfaces réseau et trafic' })
  getInterfaces() {
    return this.monitoringService.getInterfaces();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Journal des événements RouterOS' })
  getLogs() {
    return this.monitoringService.getLogs();
  }

  @Post('ping')
  @ApiOperation({ summary: 'Ping une adresse IP depuis le routeur' })
  ping(@Body() dto: PingDto) {
    return this.monitoringService.pingDevice(dto.address);
  }

  @Post('sessions/:id/disconnect')
  @ApiOperation({ summary: 'Déconnecter une session PPPoE active' })
  @ApiParam({ name: 'id', description: 'ID de la session PPPoE' })
  disconnectSession(@Param('id') id: string) {
    return this.monitoringService.disconnectSession(id);
  }

  @Post('hotspot/:id/disconnect')
  @ApiOperation({ summary: 'Déconnecter une session hotspot active' })
  @ApiParam({ name: 'id', description: 'ID de la session hotspot' })
  disconnectHotspotSession(@Param('id') id: string) {
    return this.monitoringService.disconnectHotspotSession(id);
  }
}
