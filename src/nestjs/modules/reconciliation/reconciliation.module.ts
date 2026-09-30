import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [ReconciliationController],
  providers: [ReconciliationService, PrismaService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
