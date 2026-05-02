import { Module } from '@nestjs/common';
import { RouterOSModule } from '../routeros/routeros.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [RouterOSModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
