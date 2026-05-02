import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PaymentsModule } from './payments/payments.module';
import { PlansModule } from './plans/plans.module';
import { RouterOSModule } from './routeros/routeros.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RouterOSModule,
    AuthModule,
    ClientsModule,
    PaymentsModule,
    PlansModule,
    MonitoringModule,
  ],
})
export class AppModule {}
