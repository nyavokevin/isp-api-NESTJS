import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto, ValidateTicketDto } from './tickets.dto';
import { TicketsService } from './tickets.service';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get('lookup/:ticketNumber')
  @ApiOperation({ summary: 'Lookup public d un ticket par numero' })
  lookupByTicketNumber(@Param('ticketNumber') ticketNumber: string) {
    return this.ticketsService.lookupByTicketNumber(ticketNumber);
  }

  @Post('validate-ticket')
  @ApiOperation({ summary: 'Valider un ticket public et autoriser la connexion hotspot' })
  validateTicket(@Body() dto: ValidateTicketDto) {
    return this.ticketsService.validateTicketForHotspot(
      dto.ticketNumber,
      dto.ip,
      dto.macAddress,
      dto.linkLogin,
      dto.linkOrig,
    );
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lister les tickets' })
  findAll(@Query() query: TicketQueryDto) {
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Detail d un ticket' })
  @ApiParam({ name: 'id', description: 'ID du ticket' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Creer un ticket' })
  create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mettre a jour un ticket' })
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Supprimer un ticket' })
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(id);
  }
}