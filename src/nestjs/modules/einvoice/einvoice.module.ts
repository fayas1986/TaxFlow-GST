import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { GovernmentModule } from '../government/government.module';
import { EInvoiceService } from './einvoice.service';
import { EInvoiceController } from './einvoice.controller';

@Module({
  imports: [GovernmentModule],
  controllers: [EInvoiceController],
  providers: [PrismaService, EInvoiceService],
  exports: [EInvoiceService],
})
export class EInvoiceModule {}
