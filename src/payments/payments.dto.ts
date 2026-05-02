import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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
  @ApiProperty({ example: 'c1', description: 'ID du client' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: 'INV-2025-001', description: 'Numéro de facture' })
  @IsString()
  invoice: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.MVOLA })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: '25000', description: 'Montant en Ariary' })
  @IsString()
  amount: string;

  @ApiPropertyOptional({ example: 'REF-20250101', description: 'Référence transaction' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ enum: PaymentState, default: PaymentState.COLLECTED })
  @IsOptional()
  @IsEnum(PaymentState)
  state?: PaymentState;

  @ApiProperty({ example: '2025-12-31', description: "Date d'échéance" })
  @IsISO8601()
  dueDate: string;

  @ApiPropertyOptional({ description: "Durée d'extension (ex: 30 jours)" })
  @IsOptional()
  @IsString()
  extension?: string;

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
