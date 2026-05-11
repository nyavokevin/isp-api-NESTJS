import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { PlansModule } from '../plans/plans.module';
import { RouterOSModule } from '../routeros/routeros.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [RouterOSModule, ClientsModule, PlansModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
