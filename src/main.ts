import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const prefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mini ISP Management API')
    .setDescription(
      'API de gestion ISP avec integration RouterOS/MikroTik.\n\n' +
      '**Comptes seed:**\n' +
      '- admin@isp.mg / admin123\n' +
      '- tech@isp.mg / tech123\n' +
      '- commercial@isp.mg / sales123',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentification et session')
    .addTag('Clients', 'Gestion des clients et PPPoE')
    .addTag('Payments', 'Paiements et facturation')
    .addTag('Plans', 'Plans et profils reseau')
    .addTag('Monitoring', 'Supervision reseau RouterOS')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'ISP API Docs',
  });

  const port = parseInt(process.env.PORT || '3001');
  await app.listen(port, '0.0.0.0');

  console.log('\n=================================================');
  console.log('  ISP API started on http://localhost:' + port);
  console.log('  Swagger UI: http://localhost:' + port + '/docs');
  console.log('  POST /' + prefix + '/auth/login for token');
  console.log('=================================================\n');
}

bootstrap();
