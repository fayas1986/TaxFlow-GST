import { Module } from '@nestjs/common';
import { SyncEngineService } from './sync-engine.service';
import { MappingEngineService } from './mapping-engine.service';
import { ValidationEngineService } from './validation-engine.service';
import { TaxComparisonService } from './tax-comparison.service';
import { WebhookIngestionService } from './webhook-ingestion.service';
import { AuditModule } from '../audit/audit.module';
import { TaxEngineModule } from '../tax-engine/tax-engine.module';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';

@Module({
  imports: [AuditModule, TaxEngineModule],
  providers: [
    PrismaService,
    CryptoService,
    SyncEngineService,
    MappingEngineService,
    ValidationEngineService,
    TaxComparisonService,
    WebhookIngestionService,
  ],
  exports: [
    SyncEngineService,
    MappingEngineService,
    ValidationEngineService,
    TaxComparisonService,
    WebhookIngestionService,
  ],
})
export class IntegrationModule {}
