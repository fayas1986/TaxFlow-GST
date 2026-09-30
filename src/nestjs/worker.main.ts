import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('TaxFlow BullMQ Background Worker context initialized successfully.');
}
bootstrapWorker();
