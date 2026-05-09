import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsIP, IsOptional, IsString } from 'class-validator';

export enum TicketStatus {
  ACTIVE = 'Active',
  EXPIRED = 'Expired',
}

export class CreateTicketDto {
  @ApiPropertyOptional({ example: 'c1' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ example: 'Jean Rakoto' })
  @IsString()
  client: string;

  @ApiProperty({ example: 'INV-2025-001' })
  @IsString()
  invoice: string;

  @ApiProperty({ example: 'Paiement enregistre pour INV-2025-001' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Ticket genere automatiquement apres paiement.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TicketStatus, default: TicketStatus.ACTIVE })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ example: 'p1' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({ example: '25000' })
  @IsOptional()
  @IsString()
  amount?: string;
}

export class UpdateTicketDto extends PartialType(CreateTicketDto) {}

export class ValidateTicketDto {
  @ApiProperty({ example: 'TCK-2026-00001' })
  @IsString()
  ticketNumber: string;

  @ApiPropertyOptional({ example: '192.168.88.254' })
  @IsOptional()
  @IsIP()
  ip?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional({ example: 'http://192.168.88.1/login' })
  @IsOptional()
  @IsString()
  linkLogin?: string;

  @ApiPropertyOptional({ example: 'http://example.com/' })
  @IsOptional()
  @IsString()
  linkOrig?: string;
}

export class TicketQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}