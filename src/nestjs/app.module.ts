import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './common/services/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { GstinModule } from './modules/gstin/gstin.module';
import { BranchesModule } from './modules/branches/branches.module';
import { PartiesModule } from './modules/parties/parties.module';
import { TaxEngineModule } from './modules/tax-engine/tax-engine.module';
import { TaxPeriodsModule } from './modules/tax-periods/tax-periods.module';
import { TaxLedgerModule } from './modules/tax-ledger/tax-ledger.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { Gstr2bModule } from './modules/gstr2b/gstr2b.module';
import { ItcModule } from './modules/itc/itc.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { GovernmentModule } from './modules/government/government.module';
import { EInvoiceModule } from './modules/einvoice/einvoice.module';
import { EWayBillModule } from './modules/ewaybill/ewaybill.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { BillingModule } from './modules/billing/billing.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    TenancyModule,
    CompaniesModule,
    GstinModule,
    BranchesModule,
    PartiesModule,
    TaxEngineModule,
    TaxPeriodsModule,
    TaxLedgerModule,
    InvoicesModule,
    Gstr2bModule,
    ItcModule,
    ReconciliationModule,
    ReturnsModule,
    GovernmentModule,
    EInvoiceModule,
    EWayBillModule,
    AuditModule,
    ApprovalsModule,
    DocumentsModule,
    NotificationsModule,
    IntegrationModule,
    BillingModule,
    JobsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
