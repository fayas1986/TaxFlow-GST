import { Module } from '@nestjs/common';
import { TaxLedgerService } from './tax-ledger.service';
import { TaxLedgerController } from './tax-ledger.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [TaxLedgerController],
  providers: [TaxLedgerService, PrismaService],
  exports: [TaxLedgerService],
})
export class TaxLedgerModule {}
