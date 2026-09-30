import { Module } from '@nestjs/common';
import { TaxEngineService } from './tax-engine.service';
import { TaxEngineController } from './tax-engine.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [TaxEngineController],
  providers: [TaxEngineService, PrismaService],
  exports: [TaxEngineService],
})
export class TaxEngineModule {}
