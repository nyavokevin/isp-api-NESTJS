import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PaymentState {
  COLLECTED = 'Collected',
  PENDING = 'Pending',
  OVERDUE = 'Overdue',
}

export enum PaymentMethod {
  CASH = 'cash',
  MVOLA = 'MVola',
  AIRTEL_MONEY = 'Airtel Money',
  ORANGE_MONEY = 'Orange Money',
  BANK_TRANSFER = 'Virement',
  CHEQUE = 'Chèque',
}

export class CreatePaymentDto {
  @ApiPropertyOptional({ example: 'c1', description: 'ID du client' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 'Jean Rakoto', description: 'Nom du client' })
  @IsOptional()
  @IsString()
  client?: string;

  @ApiPropertyOptional({ example: 'plan2', description: 'ID du plan choisi' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'Fibre 10 Mbps', description: 'Nom du plan choisi' })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.MVOLA })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: '25000', description: 'Montant en Ariary' })
  @IsString()
  amount: string;

  @ApiPropertyOptional({ enum: PaymentState, default: PaymentState.COLLECTED })
  @IsOptional()
  @IsEnum(PaymentState)
  state?: PaymentState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}

export class PaymentQueryDto {
  @ApiPropertyOptional({ description: 'Recherche par facture, client ou référence' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PaymentState })
  @IsOptional()
  @IsEnum(PaymentState)
  state?: PaymentState;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'ID client pour filtrer' })
  @IsOptional()
  @IsString()
  clientId?: string;
}
