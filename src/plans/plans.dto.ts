import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Fibre 10 Mbps', description: 'Nom commercial du plan' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Fiber', description: 'Type commercial du plan' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ example: 'fiber-10mbps', description: 'Identifiant profil PPPoE MikroTik' })
  @IsString()
  profileId: string;

  @ApiProperty({ example: 25000, description: 'Prix mensuel en Ariary' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 10, description: 'Débit descendant en Mbps' })
  @IsNumber()
  @Min(1)
  download: number;

  @ApiProperty({ example: 5, description: 'Débit montant en Mbps' })
  @IsNumber()
  @Min(1)
  upload: number;

  @ApiPropertyOptional({ example: '100 Go', description: 'Quota data mensuel' })
  @IsOptional()
  @IsString()
  quota?: string;

  @ApiPropertyOptional({ example: '30 jours', default: '30 jours' })
  @IsOptional()
  @IsString()
  validity?: string;

  @ApiPropertyOptional({ example: false, description: 'Offre populaire mise en avant' })
  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
