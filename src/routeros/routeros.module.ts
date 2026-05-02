import { Module } from '@nestjs/common';
import { RouterOSService } from './routeros.service';

@Module({
  providers: [RouterOSService],
  exports: [RouterOSService],
})
export class RouterOSModule {}
