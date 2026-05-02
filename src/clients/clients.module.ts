import { Module } from '@nestjs/common';
import { RouterOSModule } from '../routeros/routeros.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [RouterOSModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
