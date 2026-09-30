import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { SandboxGspAdapter } from './sandbox-gsp.adapter';
import { GovAuditLoggerService } from './gov-audit-logger.service';
import { GspCredentialsService } from './gsp-credentials.service';
import { GspCredentialsController } from './gsp-credentials.controller';

@Module({
  controllers: [GspCredentialsController],
  providers: [
    PrismaService,
    CryptoService,
    SandboxGspAdapter,
    GovAuditLoggerService,
    GspCredentialsService,
  ],
  exports: [
    CryptoService,
    SandboxGspAdapter,
    GovAuditLoggerService,
    GspCredentialsService,
  ],
})
export class GovernmentModule {}
