import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptographyService } from '../security/cryptography.service';
import { SsrfGuardService } from '../webhooks/ssrf-guard.service';
import { AuditService } from '../audit/audit.service';
import { ERPAdapterRegistryService } from './services/erp-adapter-registry.service';
import { IntegrationConnectionService } from './services/integration-connection.service';
import { GenericRestAdapter } from './adapters/generic-rest.adapter';
import { SftpFileAdapter } from './adapters/sftp-file.adapter';
import { Dynamics365BcAdapter } from './adapters/dynamics-365-bc.adapter';
import { Dynamics365FoAdapter } from './adapters/dynamics-365-fo.adapter';
import { SapAdapter } from './adapters/sap.adapter';
import { TallyPrimeAdapter } from './adapters/tally-prime.adapter';
import { ZohoBooksAdapter } from './adapters/zoho-books.adapter';
import { OracleFusionAdapter } from './adapters/oracle-fusion.adapter';

@Module({
  providers: [
    PrismaService,
    CryptographyService,
    SsrfGuardService,
    AuditService,
    ERPAdapterRegistryService,
    IntegrationConnectionService,
    GenericRestAdapter,
    SftpFileAdapter,
    Dynamics365BcAdapter,
    Dynamics365FoAdapter,
    SapAdapter,
    TallyPrimeAdapter,
    ZohoBooksAdapter,
    OracleFusionAdapter,
  ],
  exports: [
    ERPAdapterRegistryService,
    IntegrationConnectionService,
    GenericRestAdapter,
    SftpFileAdapter,
    Dynamics365BcAdapter,
    Dynamics365FoAdapter,
    SapAdapter,
    TallyPrimeAdapter,
    ZohoBooksAdapter,
    OracleFusionAdapter,
  ],
})
export class ERPAdapterFrameworkModule {}
