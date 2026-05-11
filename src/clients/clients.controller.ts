import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
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
import { ClientsService } from './clients.service';
import { ClientQueryDto, CreateClientDto, UpdateClientDto } from './clients.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des clients avec filtres optionnels' })
  @ApiResponse({ status: 200, description: 'Liste paginee des clients' })
  findAll(@Query() query: ClientQueryDto) {
    return this.clientsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques agregees des clients' })
  getStats() {
    return this.clientsService.getStats();
  }

  @Get('history')
  @ApiOperation({ summary: 'Historique recent des clients' })
  getHistory() {
    return this.clientsService.getHistory();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail client' })
  @ApiParam({ name: 'id', description: 'ID du client' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Creer un client et son secret PPPoE sur RouterOS' })
  @ApiResponse({ status: 201, description: 'Client cree' })
  @ApiResponse({ status: 409, description: 'Login PPPoE deja utilise' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un client (sync RouterOS)' })
  @ApiParam({ name: 'id', description: 'ID du client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un client et son secret PPPoE' })
  @ApiParam({ name: 'id', description: 'ID du client' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspendre un client (desactive PPPoE)' })
  @ApiParam({ name: 'id', description: 'ID du client' })
  suspend(@Param('id') id: string) {
    return this.clientsService.suspend(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activer un client (reactive PPPoE)' })
  @ApiParam({ name: 'id', description: 'ID du client' })
  activate(@Param('id') id: string) {
    return this.clientsService.activate(id);
  }
}
