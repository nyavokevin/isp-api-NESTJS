import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PaymentsModule } from './payments/payments.module';
import { PlansModule } from './plans/plans.module';
import { RouterOSModule } from './routeros/routeros.module';
import { DatabaseModule } from './database/database.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RouterOSModule,
    AuthModule,
    ClientsModule,
    PaymentsModule,
    PlansModule,
    MonitoringModule,
    TicketsModule,
  ],
})
export class AppModule {}
