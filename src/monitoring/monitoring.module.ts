import { Module } from '@nestjs/common';
import { RouterOSModule } from '../routeros/routeros.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [RouterOSModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
