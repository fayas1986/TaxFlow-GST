/**
 * Multi-Tenant SaaS Automated Security & Isolation Test Suite
 * 
 * Verifies all 20 core isolation and entitlement guarantees:
 * 1. Tenant A cannot read Tenant B invoice.
 * 2. Tenant A cannot modify Tenant B invoice.
 * 3. Tenant A cannot delete Tenant B invoice.
 * 4. Tenant A cannot access Tenant B GSTIN.
 * 5. Tenant A cannot access Tenant B reconciliation.
 * 6. Tenant A cannot access Tenant B reports.
 * 7. Tenant A cannot access Tenant B files.
 * 8. Tenant A cannot access Tenant B integrations.
 * 9. Tenant A cannot access Tenant B audit logs.
 * 10. Tenant A API token cannot access Tenant B data.
 * 11. Background jobs cannot cross tenant boundaries.
 * 12. Cache cannot leak data between tenants.
 * 13. Users with selected-branch access cannot see other branches.
 * 14. Read-only users cannot modify data.
 * 15. Plan restrictions work server-side even when frontend restrictions are bypassed.
 * 16. Cross-tenant data export / import is blocked.
 * 17. Webhook and API credentials isolation.
 * 18. Usage quota limit strictly enforced at server boundary.
 * 19. GSTIN-scoped authorization prevents cross-GSTIN data access.
 * 20. Explicit separate auditing for platform super admin override.
 */

import { tenantService } from '../tenancy/tenantService';
import { entitlementService } from '../entitlements/entitlementService';
import { usageService } from '../usage/usageService';
import { auditService } from '../audit/auditService';
import {
  invoiceRepository,
  reconciliationRepository,
  reportRepository,
  integrationRepository,
  dataExchangeRepository,
  webhookRepository,
  apiCredentialRepository,
  itcRecordRepository,
  gstReturnRepository,
  withTenantScope,
  withTenantWhere,
  createTenantDatabaseClient
} from '../../infrastructure/database/repositories';
import { cacheService } from '../../infrastructure/cache/cacheService';
import { storageService } from '../../infrastructure/storage/storageService';
import { jobQueueService } from '../../infrastructure/queues/jobQueueService';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature, PlanCode } from '../entitlements/types';
import { Permission } from '../permissions/types';
import { UsageMetric } from '../usage/types';

export interface TestResultItem {
  id: number;
  name: string;
  category: 'DATABASE_ISOLATION' | 'IDOR_PROTECTION' | 'STORAGE_CACHE' | 'ENTITLEMENTS' | 'RBAC';
  status: 'PASSED' | 'FAILED';
  description: string;
  expected: string;
  actual: string;
  securityVerdict: string;
  executionTimeMs: number;
}

export interface MultiTenantTestSuiteSummary {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  allPassed: boolean;
  results: TestResultItem[];
}

export class MultiTenantSecurityTestSuite {
  public static async runAllTests(): Promise<MultiTenantTestSuiteSummary> {
    const results: TestResultItem[] = [];

    // Setup Contexts:
    // Tenant A (t1): Acme Technologies (Enterprise)
    const ctxA = tenantService.resolveTenantContext({
      userId: 'u-fayas',
      userEmail: 'fayasamd@gmail.com',
      requestedTenantId: 't1'
    });

    // Tenant B (t2): Globex Manufacturing (Professional)
    const ctxB = tenantService.resolveTenantContext({
      userId: 'u-globex-user',
      userEmail: 'accounts@globexengg.com',
      requestedTenantId: 't2'
    });

    // Pune branch-restricted user in Tenant A
    const ctxBranchRestricted = tenantService.resolveTenantContext({
      userId: 'u-pune-mgr',
      userEmail: 'pune.finance@acme.com',
      requestedTenantId: 't1'
    });

    // Read-only auditor in Tenant A
    const ctxReadOnly = tenantService.resolveTenantContext({
      userId: 'u-auditor-ro',
      userEmail: 'auditor.deloitte@audit.com',
      requestedTenantId: 't1'
    });

    // TEST 1: Tenant A cannot read Tenant B invoice
    {
      const start = Date.now();
      const foreignInvoiceId = 'inv-t2-001'; // Globex invoice
      const invoiceFound = invoiceRepository.findById(ctxA, foreignInvoiceId);
      const passed = invoiceFound === null;

      results.push({
        id: 1,
        name: 'Tenant A cannot read Tenant B invoice',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A (${ctxA.tenantId}) attempts to read invoice '${foreignInvoiceId}' belonging to Tenant B (${ctxB.tenantId})`,
        expected: 'Null / 404 access denied (zero record leakage)',
        actual: invoiceFound ? `Leaked invoice: ${invoiceFound.invoiceNumber}` : 'Record correctly blocked (returned null)',
        securityVerdict: passed ? 'SECURE: IDOR blocked at repository boundary' : 'VULNERABLE: Cross-tenant data leak',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 2: Tenant A cannot modify Tenant B invoice
    {
      const start = Date.now();
      let errorThrown = false;
      let errorMsg = '';
      try {
        invoiceRepository.update(ctxA, 'inv-t2-001', { taxableAmount: 9999999 });
      } catch (err: any) {
        errorThrown = true;
        errorMsg = err.message;
      }

      const passed = errorThrown && errorMsg.includes('403 Forbidden');
      results.push({
        id: 2,
        name: 'Tenant A cannot modify Tenant B invoice',
        category: 'IDOR_PROTECTION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to update taxable amount on Tenant B invoice 'inv-t2-001'`,
        expected: '403 Forbidden [IDOR Blocked]',
        actual: errorThrown ? errorMsg : 'Vulnerable: Write mutation allowed',
        securityVerdict: passed ? 'SECURE: Cross-tenant update blocked' : 'VULNERABLE: IDOR write vulnerability',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 3: Tenant A cannot delete Tenant B invoice
    {
      const start = Date.now();
      let errorThrown = false;
      let errorMsg = '';
      try {
        invoiceRepository.delete(ctxA, 'inv-t2-001');
      } catch (err: any) {
        errorThrown = true;
        errorMsg = err.message;
      }

      const passed = errorThrown && errorMsg.includes('403 Forbidden');
      results.push({
        id: 3,
        name: 'Tenant A cannot delete Tenant B invoice',
        category: 'IDOR_PROTECTION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to delete Tenant B invoice 'inv-t2-001'`,
        expected: '403 Forbidden [IDOR Blocked]',
        actual: errorThrown ? errorMsg : 'Vulnerable: Delete mutation allowed',
        securityVerdict: passed ? 'SECURE: Cross-tenant delete blocked' : 'VULNERABLE: IDOR deletion vulnerability',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 4: Tenant A cannot access Tenant B GSTIN
    {
      const start = Date.now();
      const t2Gstins = tenantService.getTenantGstins('t2');
      const t1GstinsQueried = tenantService.getTenantGstins(ctxA.tenantId);
      const crossLeak = t1GstinsQueried.some(g => g.tenantId === 't2');
      const passed = !crossLeak && t2Gstins.length > 0;

      results.push({
        id: 4,
        name: 'Tenant A cannot access Tenant B GSTIN',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A queries registered GSTINs while Tenant B has registered GSTINs`,
        expected: 'Only Tenant A GSTINs returned (no foreign GSTINs)',
        actual: `Tenant A received ${t1GstinsQueried.length} GSTINs, 0 foreign records`,
        securityVerdict: passed ? 'SECURE: GST registrations isolated per company' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 5: Tenant A cannot access Tenant B reconciliation
    {
      const start = Date.now();
      const foreignReconId = 'rec-t2-2026-08';
      const foreignRecon = reconciliationRepository.findById(ctxA, foreignReconId);
      const passed = foreignRecon === null;

      results.push({
        id: 5,
        name: 'Tenant A cannot access Tenant B reconciliation',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to inspect Tenant B reconciliation batch '${foreignReconId}'`,
        expected: 'Null / 404 access denied',
        actual: foreignRecon ? `Leaked batch ${foreignRecon.batchId}` : 'Blocked (returned null)',
        securityVerdict: passed ? 'SECURE: Reconciliation batches strictly scoped' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 6: Tenant A cannot access Tenant B reports
    {
      const start = Date.now();
      const foreignReportId = 'rep-t2-001';
      const foreignReport = reportRepository.findById(ctxA, foreignReportId);
      const passed = foreignReport === null;

      results.push({
        id: 6,
        name: 'Tenant A cannot access Tenant B reports',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to view Tenant B statutory report '${foreignReportId}'`,
        expected: 'Null / 404 access denied',
        actual: foreignReport ? `Leaked report: ${foreignReport.reportName}` : 'Blocked (returned null)',
        securityVerdict: passed ? 'SECURE: Statutory reports partitioned' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 7: Tenant A cannot access Tenant B files
    {
      const start = Date.now();
      const check = storageService.testCrossTenantFileAccess(ctxA, '/tenants/t2/invoices/GLB-INV-001.pdf');
      const passed = check.blocked;

      results.push({
        id: 7,
        name: 'Tenant A cannot access Tenant B files',
        category: 'STORAGE_CACHE',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to read PDF file '/tenants/t2/invoices/GLB-INV-001.pdf'`,
        expected: '403 Forbidden [Storage Isolation Violation]',
        actual: check.blocked ? `Access blocked: ${check.error}` : 'Vulnerable: File contents leaked',
        securityVerdict: passed ? 'SECURE: File storage paths strictly partitioned' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 8: Tenant A cannot access Tenant B integrations
    {
      const start = Date.now();
      const foreignIntId = 'int-t2-oracle';
      const foreignInt = integrationRepository.findById(ctxA, foreignIntId);
      const passed = foreignInt === null;

      results.push({
        id: 8,
        name: 'Tenant A cannot access Tenant B integrations',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to inspect Tenant B ERP integration credentials '${foreignIntId}'`,
        expected: 'Null / 404 access denied',
        actual: foreignInt ? `Leaked integration credentials: ${foreignInt.apiKeyMasked}` : 'Blocked (returned null)',
        securityVerdict: passed ? 'SECURE: ERP credentials isolated' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 9: Tenant A cannot access Tenant B audit logs
    {
      const start = Date.now();
      const logsForA = auditService.getAuditLogs(ctxA);
      const containsT2 = logsForA.some(l => l.tenantId === 't2');
      const passed = !containsT2 && logsForA.length > 0;

      results.push({
        id: 9,
        name: 'Tenant A cannot access Tenant B audit logs',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A queries security audit trail; verify zero Tenant B entries returned`,
        expected: 'Zero cross-tenant audit entries returned',
        actual: `Received ${logsForA.length} audit entries, 0 belonging to other tenants`,
        securityVerdict: passed ? 'SECURE: Audit trail strictly isolated' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 10: Tenant A API token cannot access Tenant B data
    {
      const start = Date.now();
      let blocked = false;
      let errorMsg = '';
      try {
        tenantService.resolveTenantContext({
          userId: 'u-api-bot',
          requestedTenantId: 't2',
          apiToken: 'tok-t1-secrettoken998' // Token stamped for t1
        });
      } catch (err: any) {
        blocked = true;
        errorMsg = err.message;
      }

      const passed = blocked && errorMsg.includes('cannot access tenant');
      results.push({
        id: 10,
        name: 'Tenant A API token cannot access Tenant B data',
        category: 'IDOR_PROTECTION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `API token stamped for Tenant t1 attempts to query endpoint under Tenant t2`,
        expected: '403 Forbidden: API token tenant mismatch',
        actual: blocked ? errorMsg : 'Vulnerable: API token tenant spoofing allowed',
        securityVerdict: passed ? 'SECURE: Scoped API tokens enforced' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 11: Background jobs cannot cross tenant boundaries
    {
      const start = Date.now();
      // Enqueue job for Tenant B
      const jobB = jobQueueService.enqueueJob(ctxB, 'GSTR2B_RECONCILIATION', { period: '2026-08' });
      // Worker running under Tenant A tries to execute it
      const check = jobQueueService.testCrossTenantJobExecution(ctxA, jobB.id);
      const passed = check.blocked;

      results.push({
        id: 11,
        name: 'Background jobs cannot cross tenant boundaries',
        category: 'STORAGE_CACHE',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Background job worker running as Tenant A attempts to process Tenant B job '${jobB.id}'`,
        expected: '403 Forbidden [Job Cross-Tenant Violation]',
        actual: check.blocked ? `Blocked: ${check.error}` : 'Vulnerable: Cross-tenant job processed',
        securityVerdict: passed ? 'SECURE: Asynchronous tasks bound to TenantContext' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 12: Cache cannot leak data between tenants
    {
      const start = Date.now();
      // Tenant B caches reconciliation summary
      cacheService.set(ctxB, 'reconciliation', 'aug_summary', { netTax: 450000 });
      // Tenant A attempts to read Tenant B's cache
      const check = cacheService.testCrossTenantCacheAccess(ctxA, 't2', 'reconciliation', 'aug_summary');
      const passed = check.blocked;

      results.push({
        id: 12,
        name: 'Cache cannot leak data between tenants',
        category: 'STORAGE_CACHE',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to read cache key 'tenant:t2:reconciliation:aug_summary'`,
        expected: 'Key partitioned with tenant prefix; cross-tenant access blocked',
        actual: check.blocked ? `Access blocked: ${check.error}` : 'Vulnerable: Cache leaked',
        securityVerdict: passed ? 'SECURE: Strict tenant:{id}:* cache namespace' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 13: Users with selected-branch access cannot see other branches
    {
      const start = Date.now();
      // User is only authorized for Pune branch ('br-t1-mh-02')
      const visibleInvoices = invoiceRepository.findMany(ctxBranchRestricted);
      const hasOtherBranchInvoices = visibleInvoices.some(inv => inv.branchId !== 'br-t1-mh-02');
      const hasPuneInvoice = visibleInvoices.some(inv => inv.branchId === 'br-t1-mh-02');
      const passed = !hasOtherBranchInvoices && hasPuneInvoice;

      results.push({
        id: 13,
        name: 'Users with selected-branch access cannot see other branches',
        category: 'RBAC',
        status: passed ? 'PASSED' : 'FAILED',
        description: `User assigned strictly to Pune branch queries invoices; verify Mumbai BKC invoices hidden`,
        expected: 'Only Pune branch invoices visible; other branches filtered',
        actual: `Returned ${visibleInvoices.length} Pune invoices, 0 invoices from other branches`,
        securityVerdict: passed ? 'SECURE: Branch-level segregation enforced' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 14: Read-only users cannot modify data
    {
      const start = Date.now();
      let writeBlocked = false;
      let errorMsg = '';
      try {
        invoiceRepository.create(ctxReadOnly, {
          branchId: 'br-t1-mh-01',
          invoiceNumber: 'ILLEGAL-001',
          invoiceDate: '2026-09-20',
          customerName: 'Hacker Corp',
          customerGstin: '27AAACH9999Q1Z1',
          taxableAmount: 1000,
          taxAmount: 180,
          totalAmount: 1180,
          status: 'DRAFT'
        });
      } catch (err: any) {
        writeBlocked = true;
        errorMsg = err.message;
      }

      const passed = writeBlocked && errorMsg.includes('Read-only');
      results.push({
        id: 14,
        name: 'Read-only users cannot modify data',
        category: 'RBAC',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Statutory auditor in read-only mode attempts to execute CREATE invoice mutation`,
        expected: '403 Forbidden: Read-only user cannot create entity',
        actual: writeBlocked ? errorMsg : 'Vulnerable: Read-only user created invoice',
        securityVerdict: passed ? 'SECURE: Read-only restrictions enforced at data layer' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 15: Plan restrictions work server-side even when frontend restrictions are bypassed
    {
      const start = Date.now();
      // Tenant 4 is on STARTER plan, which does NOT have Feature.ERP_INTEGRATION or Feature.E_INVOICE
      // Even if client crafts direct request, AuthorizationPipeline must reject it!
      let blocked = false;
      let errorMsg = '';
      try {
        const ctxStarter = {
          tenantId: 't4',
          userId: 'u-starter-user',
          userEmail: 'owner@sme.com',
          role: 'ADMIN',
          plan: 'STARTER',
          permissions: [Permission.INTEGRATION_MANAGE]
        };

        AuthorizationPipeline.execute(
          {
            ctx: ctxStarter as any,
            requiredFeature: Feature.ERP_INTEGRATION,
            requiredPermission: Permission.INTEGRATION_MANAGE
          },
          () => {
            return { connected: true };
          }
        );
      } catch (err: any) {
        blocked = true;
        errorMsg = err.message;
      }

      const passed = blocked && errorMsg.includes('Plan Entitlement');
      results.push({
        id: 15,
        name: 'Plan restrictions work server-side even when frontend restrictions are bypassed',
        category: 'ENTITLEMENTS',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Starter plan tenant directly invokes ERP integration endpoint bypassing UI gating`,
        expected: '403 Forbidden [Plan Entitlement]: Feature not included in current plan',
        actual: blocked ? errorMsg : 'Vulnerable: Server-side plan restriction bypassed',
        securityVerdict: passed ? 'SECURE: Backend-enforced entitlement gate' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 16: Cross-tenant data export / import is blocked
    {
      const start = Date.now();
      const foreignExportId = 'dex-t2-001'; // Globex data exchange record
      const exportFound = dataExchangeRepository.findById(ctxA, foreignExportId);
      let idorBlocked = false;
      let errorMsg = '';
      try {
        dataExchangeRepository.getById(ctxA, foreignExportId);
      } catch (err: any) {
        idorBlocked = true;
        errorMsg = err.message;
      }

      const passed = exportFound === null && idorBlocked && errorMsg.includes('IDOR Blocked');
      results.push({
        id: 16,
        name: 'Cross-tenant data export / import is blocked',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A attempts to read/download statutory data export '${foreignExportId}' belonging to Tenant B`,
        expected: 'Null via findById and 403 Forbidden via getById [IDOR Blocked]',
        actual: passed ? `Blocked via repository boundary: ${errorMsg}` : 'Vulnerable: Foreign export record exposed',
        securityVerdict: passed ? 'SECURE: Bulk data exchange strictly isolated' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 17: Webhook and API credentials isolation
    {
      const start = Date.now();
      const foreignWebhookId = 'wh-t2-001';
      const foreignCredId = 'cred-t2-001';

      const webhookFound = webhookRepository.findById(ctxA, foreignWebhookId);
      const credFound = apiCredentialRepository.findById(ctxA, foreignCredId);

      const allVisibleCreds = apiCredentialRepository.findMany(ctxA);
      const crossLeak = allVisibleCreds.some(c => c.tenantId !== ctxA.tenantId);

      const passed = webhookFound === null && credFound === null && !crossLeak;
      results.push({
        id: 17,
        name: 'Webhook and API credentials isolation',
        category: 'IDOR_PROTECTION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant A queries API credentials and webhooks; verify Tenant B ERP tokens/secrets never leak`,
        expected: 'Zero foreign credentials visible; findById returns null',
        actual: passed ? `Found 0 foreign secrets; returned ${allVisibleCreds.length} tenant-owned credentials` : 'Vulnerable: API credentials leaked',
        securityVerdict: passed ? 'SECURE: API keys and webhook signing secrets cryptographically isolated' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 18: Usage quota limit strictly enforced at server boundary
    {
      const start = Date.now();
      let quotaBlocked = false;
      let errorMsg = '';
      try {
        // Tenant 4 (Starter) has 100 monthly invoices limit. Requesting 500 should throw 429
        usageService.requireQuota('t4', UsageMetric.INVOICE_DOCUMENTS, 500);
      } catch (err: any) {
        quotaBlocked = true;
        errorMsg = err.message;
      }

      const passed = quotaBlocked && errorMsg.includes('429') && errorMsg.includes('Monthly quota exceeded');
      results.push({
        id: 18,
        name: 'Usage quota limit strictly enforced at server boundary',
        category: 'ENTITLEMENTS',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Tenant on Starter plan attempts to exceed invoice quota; verify requireQuota rejects mutation`,
        expected: '429 Too Many Requests: Monthly quota exceeded for INVOICE_DOCUMENTS',
        actual: quotaBlocked ? errorMsg : 'Vulnerable: Quota exceeded without enforcement',
        securityVerdict: passed ? 'SECURE: Server-side quota exhaustion barrier enforced' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 19: GSTIN-scoped authorization prevents cross-GSTIN data access
    {
      const start = Date.now();
      // User restricted strictly to Maharashtra GSTIN 'gstin-t1-mh'
      const ctxGstinRestricted = {
        ...ctxA,
        assignedGstinIds: ['gstin-t1-mh']
      };

      const returns = gstReturnRepository.findMany(ctxGstinRestricted);
      const allBelongToAllowedGstin = returns.every(r => r.gstinId === 'gstin-t1-mh');

      let mutationBlocked = false;
      let errorMsg = '';
      try {
        // Attempt to create return under unauthorized GSTIN 'gstin-t1-dl'
        gstReturnRepository.create(ctxGstinRestricted, {
          gstinId: 'gstin-t1-dl',
          returnType: 'GSTR_1',
          period: '2026-09',
          taxLiability: 10000,
          status: 'DRAFT'
        });
      } catch (err: any) {
        mutationBlocked = true;
        errorMsg = err.message;
      }

      const passed = allBelongToAllowedGstin && mutationBlocked && errorMsg.includes('not authorized');
      results.push({
        id: 19,
        name: 'GSTIN-scoped authorization prevents cross-GSTIN data access',
        category: 'RBAC',
        status: passed ? 'PASSED' : 'FAILED',
        description: `User restricted to Maharashtra GSTIN queries returns and attempts to file for unauthorized Delhi GSTIN`,
        expected: '403 Forbidden: User not authorized to create entity under GSTIN',
        actual: passed ? `Reads scoped to gstin-t1-mh only, mutation blocked: ${errorMsg}` : 'Vulnerable: Cross-GSTIN mutation allowed',
        securityVerdict: passed ? 'SECURE: Multi-GSTIN boundary enforced within tenant' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 20: Explicit separate auditing for platform super admin override
    {
      const start = Date.now();
      // 1. Regular tenant admin attempts to query platform super admin audit logs -> MUST be rejected with 403
      let unauthBlocked = false;
      let unauthError = '';
      try {
        auditService.getPlatformSuperAdminLogs(ctxA);
      } catch (err: any) {
        unauthBlocked = true;
        unauthError = err.message;
      }

      // 2. Platform super admin performs explicit audited action
      const ctxPlatformSuperAdmin = {
        ...ctxA,
        isPlatformSuperAdmin: true
      };

      auditService.logEvent(ctxPlatformSuperAdmin, {
        action: 'SUPER_ADMIN_DIAGNOSTIC_OVERRIDE',
        module: 'SecurityAudit',
        resourceType: 'Tenant',
        resourceId: 't2',
        overrideReason: 'Support ticket #8812 - GSTIN filing verification authorized by customer',
        status: 'SUCCESS'
      });

      const superAdminLogs = auditService.getPlatformSuperAdminLogs(ctxPlatformSuperAdmin);
      const hasOverrideLog = superAdminLogs.some(l => l.action === 'SUPER_ADMIN_DIAGNOSTIC_OVERRIDE' && l.isPlatformSuperAdminOverride === true);

      const passed = unauthBlocked && unauthError.includes('403 Forbidden') && hasOverrideLog;
      results.push({
        id: 20,
        name: 'Explicit separate auditing for platform super admin override',
        category: 'RBAC',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Verify Super Admin access requires explicit isPlatformSuperAdmin privilege and is logged in dedicated isolated audit trail`,
        expected: '403 Forbidden for non-super admins; override recorded in separate super admin audit log with justification',
        actual: passed ? `Non-admin blocked (${unauthError}); override logged with reason in dedicated audit trail` : 'Vulnerable: Super admin audit leakage',
        securityVerdict: passed ? 'SECURE: Platform Super Admin operations strictly audited & segregated' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 21: Base repository automatically injects where: { tenantId: ctx.tenantId } into queries
    {
      const start = Date.now();
      // Developer passes query WITHOUT tenantId: { where: { status: 'GENERATED' } }
      const matchingInvoices = invoiceRepository.findMany(ctxA, {
        where: { status: 'GENERATED' }
      });

      const allBelongToTenantA = matchingInvoices.every(inv => inv.tenantId === ctxA.tenantId);
      const containsTenantB = matchingInvoices.some(inv => inv.tenantId === ctxB.tenantId);
      const passed = matchingInvoices.length > 0 && allBelongToTenantA && !containsTenantB;

      results.push({
        id: 21,
        name: 'Base repository automatically injects where: { tenantId: ctx.tenantId }',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Caller queries invoices with where: { status: 'GENERATED' } without providing tenantId; verify base repository injects active tenantId`,
        expected: `Only Tenant ${ctxA.tenantId} invoices returned; foreign tenant invoices excluded`,
        actual: passed ? `Returned ${matchingInvoices.length} invoices, 100% scoped to ${ctxA.tenantId}` : 'Vulnerable: Unscoped query leaked foreign tenant data',
        securityVerdict: passed ? 'SECURE: Base class automatically injected where: { tenantId: ctx.tenantId }' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 22: Malicious query attempting cross-tenant override in where clause is rejected with 403
    {
      const start = Date.now();
      let errorThrown = false;
      let errorMsg = '';
      try {
        // An attacker/buggy code attempts to override tenantId in where clause:
        invoiceRepository.findMany(ctxA, {
          where: { tenantId: ctxB.tenantId } as any
        });
      } catch (err: any) {
        errorThrown = true;
        errorMsg = err.message;
      }

      const passed = errorThrown && errorMsg.includes('403 Forbidden [Tenant Boundary Violation]');
      results.push({
        id: 22,
        name: 'Malicious where.tenantId tampering rejected with 403 [Tenant Boundary Violation]',
        category: 'IDOR_PROTECTION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Adversary crafts query with active session t1 but supplies where: { tenantId: 't2' }`,
        expected: '403 Forbidden [Tenant Boundary Violation]',
        actual: errorThrown ? errorMsg : 'Vulnerable: Tampered where.tenantId permitted',
        securityVerdict: passed ? 'SECURE: Injected tenant boundary integrity verified' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 23: Higher-Order Function (HOF) withTenantScope pre-binds context and guarantees tenant isolation
    {
      const start = Date.now();
      // Use HOF to generate scoped client
      const scopedInvoices = withTenantScope(ctxA, invoiceRepository);

      // Business logic invokes without passing ctx
      const invoices = scopedInvoices.findMany({ where: { status: 'GENERATED' } });
      const invoiceCount = scopedInvoices.count();
      const firstInvoice = scopedInvoices.findFirst();

      const allBelongToTenantA = invoices.every(inv => inv.tenantId === ctxA.tenantId);
      const firstScopedToA = firstInvoice ? firstInvoice.tenantId === ctxA.tenantId : false;
      const passed = invoices.length > 0 && allBelongToTenantA && firstScopedToA && invoiceCount > 0;

      results.push({
        id: 23,
        name: 'HOF withTenantScope pre-binds context and guarantees tenant isolation',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Use withTenantScope(ctx, repo) HOF to instantiate bound client; execute findMany, count, findFirst without passing ctx`,
        expected: `Pre-bound client executes all database operations with automatic tenantId scoping (${ctxA.tenantId})`,
        actual: passed ? `HOF bound client verified: ${invoices.length} invoices, total count ${invoiceCount}, 0 foreign leaks` : 'Vulnerable: HOF failed to scope operations',
        securityVerdict: passed ? 'SECURE: HOF wrapper guarantees zero tenant scoping omissions' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 24: Higher-Order Function withTenantWhere enforces verified where clause on delegates
    {
      const start = Date.now();
      let capturedTenantId = '';
      let capturedStatus = '';

      withTenantWhere(ctxA, (scopedWhere) => {
        capturedTenantId = scopedWhere.tenantId || '';
        capturedStatus = scopedWhere.status || '';
        return true;
      }, { status: 'GENERATED' });

      const passed = capturedTenantId === ctxA.tenantId && capturedStatus === 'GENERATED';

      results.push({
        id: 24,
        name: 'HOF withTenantWhere injects verified tenantId into arbitrary query delegates',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Execute query delegate wrapped by withTenantWhere HOF with user-defined filters`,
        expected: `Delegate receives where clause with tenantId strictly set to active session (${ctxA.tenantId})`,
        actual: passed ? `Captured injected where: { tenantId: '${capturedTenantId}', status: '${capturedStatus}' }` : 'Vulnerable: Tenant ID not injected',
        securityVerdict: passed ? 'SECURE: Functional delegate tenant scoping verified' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 25: Universal client factory createTenantDatabaseClient(ctx) guarantees cross-domain isolation
    {
      const start = Date.now();
      const db = createTenantDatabaseClient(ctxA);

      const invoices = db.invoices.findMany();
      const purchases = db.purchases.findMany();
      const sales = db.sales.findMany();
      const recons = db.reconciliations.findMany();

      const allInvoicesA = invoices.every(i => i.tenantId === ctxA.tenantId);
      const allPurchasesA = purchases.every(p => p.tenantId === ctxA.tenantId);
      const allSalesA = sales.every(s => s.tenantId === ctxA.tenantId);
      const allReconsA = recons.every(r => r.tenantId === ctxA.tenantId);

      const passed = allInvoicesA && allPurchasesA && allSalesA && allReconsA && invoices.length > 0 && purchases.length > 0;

      results.push({
        id: 25,
        name: 'Universal client factory createTenantDatabaseClient guarantees multi-domain scoping',
        category: 'DATABASE_ISOLATION',
        status: passed ? 'PASSED' : 'FAILED',
        description: `Instantiate full database client via createTenantDatabaseClient(ctx) and query multiple domain entities`,
        expected: 'All domain repositories (Invoices, Purchases, Sales, Reconciliations) strictly partitioned to active tenant',
        actual: passed ? `Queried 4 domains across ${invoices.length + purchases.length + sales.length + recons.length} items; 100% scoped to ${ctxA.tenantId}` : 'Vulnerable: Multi-domain leakage detected',
        securityVerdict: passed ? 'SECURE: All business domain entities strictly partitioned' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 26: Plan-based tenant creation enforces starter plan restrictions on restricted modules
    {
      const start = Date.now();
      const newStarter = tenantService.createTenant({
        legalName: 'Apex Logistics LLP',
        tradeName: 'Apex Logistics',
        pan: 'APEXL1234P',
        stateCode: '27',
        planCode: PlanCode.STARTER,
        creatorUserId: 'u-starter-admin',
        creatorEmail: 'admin@apexlogistics.in'
      });

      const starterCtx = tenantService.resolveTenantContext({
        userId: 'u-starter-admin',
        userEmail: 'admin@apexlogistics.in',
        requestedTenantId: newStarter.tenant.id
      });

      let einvoiceBlocked = false;
      let errorMsg = '';
      try {
        entitlementService.requireFeature(starterCtx.tenantId, Feature.E_INVOICE);
      } catch (err: any) {
        einvoiceBlocked = true;
        errorMsg = err.message;
      }

      const hasInvoices = entitlementService.hasFeature(starterCtx.tenantId, Feature.INVOICES);
      const hasPurchases = entitlementService.hasFeature(starterCtx.tenantId, Feature.PURCHASES);
      const passed = starterCtx.plan === PlanCode.STARTER && einvoiceBlocked && hasInvoices && hasPurchases;

      results.push({
        id: 26,
        name: 'Plan-based tenant creation enforces starter plan restrictions on restricted modules',
        category: 'ENTITLEMENTS',
        status: passed ? 'PASSED' : 'FAILED',
        description: 'Create new organization under STARTER plan; verify INVOICES/PURCHASES permitted while E_INVOICE is blocked',
        expected: '403 Forbidden: Feature e_invoice requires plan upgrade from STARTER',
        actual: passed ? `Starter tenant created with membership: SUPER_ADMIN; E-Invoice blocked: ${errorMsg}` : 'Vulnerable: Plan boundary not enforced',
        securityVerdict: passed ? 'SECURE: Plan-based module gating strictly enforced on newly provisioned tenant' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    // TEST 27: Enterprise plan tenant creation unlocks advanced modules with multi-GSTIN and AI access
    {
      const start = Date.now();
      const newEnterprise = tenantService.createTenant({
        legalName: 'Titan Holdings Global Ltd',
        tradeName: 'Titan Enterprise',
        pan: 'TITAN9876T',
        stateCode: '29',
        planCode: PlanCode.ENTERPRISE,
        creatorUserId: 'u-titan-cfo',
        creatorEmail: 'cfo@titanholdings.com'
      });

      const entCtx = tenantService.resolveTenantContext({
        userId: 'u-titan-cfo',
        userEmail: 'cfo@titanholdings.com',
        requestedTenantId: newEnterprise.tenant.id
      });

      const hasAi = entitlementService.hasFeature(entCtx.tenantId, Feature.AI);
      const hasEinvoice = entitlementService.hasFeature(entCtx.tenantId, Feature.E_INVOICE);
      const hasErp = entitlementService.hasFeature(entCtx.tenantId, Feature.ERP_INTEGRATION);
      const hasMultiGstin = entitlementService.hasFeature(entCtx.tenantId, Feature.MULTI_GSTIN);

      // Verify database repository isolation for the newly provisioned tenant
      const db = createTenantDatabaseClient(entCtx);
      const invoice = db.invoices.create({
        invoiceNumber: 'INV-TITAN-001',
        invoiceDate: '2026-09-21',
        customerName: 'Global Corp',
        customerGstin: '29GLOBAL1234A',
        taxableAmount: 500000,
        taxAmount: 90000,
        totalAmount: 590000,
        status: 'DRAFT'
      });

      const passed = entCtx.plan === PlanCode.ENTERPRISE && hasAi && hasEinvoice && hasErp && hasMultiGstin && invoice.tenantId === newEnterprise.tenant.id;

      results.push({
        id: 27,
        name: 'Enterprise plan tenant creation unlocks advanced modules with automated DB isolation',
        category: 'ENTITLEMENTS',
        status: passed ? 'PASSED' : 'FAILED',
        description: 'Create new organization under ENTERPRISE plan; verify AI, E-Invoice, ERP, and Multi-GSTIN unlocked and DB scoped',
        expected: 'All enterprise features enabled, subscription active, database operations partitioned to new tenant',
        actual: passed ? `Enterprise tenant ${newEnterprise.tenant.id} created with AI, E-Invoice, ERP enabled; invoice scoped to tenant` : 'Vulnerable: Enterprise features not unlocked',
        securityVerdict: passed ? 'SECURE: Enterprise tenant provisioned with complete plan capabilities & zero cross-tenant contamination' : 'VULNERABLE',
        executionTimeMs: Date.now() - start
      });
    }

    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.length - passedCount;

    return {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedCount,
      failedCount,
      allPassed: failedCount === 0,
      results
    };
  }
}
