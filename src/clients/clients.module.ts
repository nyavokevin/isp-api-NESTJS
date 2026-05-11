import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { RouterOSModule } from '../routeros/routeros.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [RouterOSModule, PlansModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
