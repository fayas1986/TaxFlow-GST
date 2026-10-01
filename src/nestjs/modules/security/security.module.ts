import { Injectable, Module } from '@nestjs/common';
import { MultiTenantSecurityGuardService } from './multi-tenant-security-guard.service';
import { FinancialSecurityService } from './financial-security.service';

@Module({
  providers: [
    MultiTenantSecurityGuardService,
    FinancialSecurityService,
  ],
  exports: [
    MultiTenantSecurityGuardService,
    FinancialSecurityService,
  ],
})
export class SecurityModule {}
