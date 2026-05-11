import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
}

export class CreateClientDto {
  @ApiProperty({ example: 'Jean Rakoto', description: 'Nom complet du client' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: '+261340000001', description: 'Numero de telephone' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Lot II J 45 Antananarivo', description: 'Adresse de service' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'jean.rakoto', description: 'Login PPPoE (unique)' })
  @IsString()
  @MinLength(3)
  pppoeLogin: string;

  @ApiProperty({ example: 'secret123', description: 'Mot de passe PPPoE' })
  @IsString()
  @MinLength(4)
  pppoePassword: string;

  @ApiProperty({ example: 'fiber-10mbps', description: 'Identifiant du plan souscrit' })
  @IsString()
  plan: string;

  @ApiPropertyOptional({ example: 'plan2', description: 'ID interne du plan souscrit' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: ClientStatus, default: ClientStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiProperty({ example: '2025-12-31', description: 'Date expiration ISO8601' })
  @IsISO8601()
  expiration: string;

  @ApiProperty({ example: 'Antananarivo Centre', description: 'Zone de couverture' })
  @IsString()
  area: string;

  @ApiPropertyOptional({ example: '0', description: 'Solde initial en Ariary' })
  @IsOptional()
  @IsString()
  balance?: string;

  @ApiPropertyOptional({ example: 'Client reference par...' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class ClientQueryDto {
  @ApiPropertyOptional({ description: 'Recherche par nom, login ou telephone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ClientStatus })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional({ description: 'Filtrer par zone' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ description: 'Filtrer par plan' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ description: 'Filtrer par ID du plan' })
  @IsOptional()
  @IsString()
  planId?: string;
}
