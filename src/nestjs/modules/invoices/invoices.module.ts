import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PrismaService } from '../../common/services/prisma.service';
import { TaxEngineModule } from '../tax-engine/tax-engine.module';
import { TaxPeriodsModule } from '../tax-periods/tax-periods.module';
import { TaxLedgerModule } from '../tax-ledger/tax-ledger.module';

@Module({
  imports: [TaxEngineModule, TaxPeriodsModule, TaxLedgerModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PrismaService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
