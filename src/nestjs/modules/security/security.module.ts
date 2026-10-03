import { Injectable, Module } from '@nestjs/common';
import { MultiTenantSecurityGuardService } from './multi-tenant-security-guard.service';
import { FinancialSecurityService } from './financial-security.service';
import { CryptographyService } from './cryptography.service';

@Module({
  providers: [
    MultiTenantSecurityGuardService,
    FinancialSecurityService,
    CryptographyService,
  ],
  exports: [
    MultiTenantSecurityGuardService,
    FinancialSecurityService,
    CryptographyService,
  ],
})
export class SecurityModule {}
