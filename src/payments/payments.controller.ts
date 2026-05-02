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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentQueryDto, UpdatePaymentDto } from './payments.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste complète des transactions' })
  findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord paiements (revenus, impayés, stats)' })
  getDashboard() {
    return this.paymentsService.getDashboard();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une transaction" })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Enregistrer un paiement' })
  @ApiResponse({ status: 201, description: 'Paiement enregistré' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un paiement' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un paiement' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
