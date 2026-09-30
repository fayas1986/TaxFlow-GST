import { Module } from '@nestjs/common';
import { ItcService } from './itc.service';
import { ItcController } from './itc.controller';
import { PrismaService } from '../../common/services/prisma.service';
import { TaxLedgerModule } from '../tax-ledger/tax-ledger.module';

@Module({
  imports: [TaxLedgerModule],
  controllers: [ItcController],
  providers: [ItcService, PrismaService],
  exports: [ItcService],
})
export class ItcModule {}
