/**
 * Tenant Security Negative Regression & Escalation Test Suite
 * Validates cross-tenant header tampering rejection, company/GSTIN/branch ID spoofing prevention,
 * direct object access (IDOR) blocks, and plan entitlement escalation prevention.
 */

import { AuthorizationPipeline } from '../../../src/infrastructure/security/idorProtection';
import { tenantService } from '../../core/tenancy/tenantService';
import { entitlementService } from '../../core/entitlements/entitlementService';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';

export interface SecurityNegativeTestResult {
  testName: string;
  category: string;
  passed: boolean;
  details: string;
}

export class TenantSecurityNegativeRegressionTestSuite {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: SecurityNegativeTestResult[];
  }> {
    const results: SecurityNegativeTestResult[] = [];

    // Test 1: Manipulated Header Tenant ID Rejection
    try {
      const victimTenantId = 't1';
      const attackerSessionUserId = 'u-globex-user'; // Belongs to t2

      let blockedTamper = false;
      try {
        tenantService.resolveTenantContext({
          userId: attackerSessionUserId,
          userEmail: 'finance@globex.in',
          requestedTenantId: victimTenantId,
        });
      } catch (err: any) {
        blockedTamper = err.message.includes('403 Forbidden') || err.message.includes('Unauthorized') || err.message.includes('Access denied');
      }

      results.push({
        testName: 'Cross-Tenant Header Tampering & Tenant ID Spoofing Rejection',
        category: 'Anti-IDOR Security',
        passed: blockedTamper,
        details: blockedTamper ? 'Successfully rejected header manipulation attempt with HTTP 403 Forbidden' : 'VULNERABLE: Header spoofing allowed cross-tenant access',
      });
    } catch (e: any) {
      results.push({ testName: 'Header Tampering Rejection', category: 'Anti-IDOR Security', passed: false, details: e.message });
    }

    // Test 2: Subscription Entitlement Escalation Block (Starter Tenant accessing Enterprise Feature)
    try {
      const starterTenantId = 't4'; // Starter plan (suspended / no AI/ERP/E-Invoice)

      let blockedEscalation = false;
      try {
        entitlementService.requireFeature(starterTenantId, Feature.E_INVOICE);
      } catch (err: any) {
        blockedEscalation = err.message.includes('403 Forbidden') || err.message.includes('Plan Entitlement');
      }

      results.push({
        testName: 'Plan Feature Entitlement Privilege Escalation Prevention',
        category: 'Entitlement Security',
        passed: blockedEscalation,
        details: blockedEscalation ? 'Successfully blocked unauthorized access attempt to Enterprise feature by Starter tenant' : 'VULNERABLE: Plan feature escalation succeeded',
      });
    } catch (e: any) {
      results.push({ testName: 'Entitlement Escalation Prevention', category: 'Entitlement Security', passed: false, details: e.message });
    }

    // Test 3: Direct Object Access / Resource ID Tampering
    try {
      const tenantContext = tenantService.resolveTenantContext({
        userId: 'u-fayas',
        userEmail: 'fayasamd@gmail.com',
        requestedTenantId: 't1',
      });

      let blockedIdor = false;
      try {
        AuthorizationPipeline.execute(
          {
            ctx: tenantContext,
            resourceOwnerTenantId: 't2-globex', // Resource belongs to t2!
            requiredPermission: Permission.INVOICE_VIEW,
            auditAction: 'INVOICE_VIEW',
            auditModule: 'Invoices',
          },
          () => ({ success: true })
        );
      } catch (err: any) {
        blockedIdor = err.message.includes('403 Forbidden') || err.message.includes('Tenant Boundary Violation');
      }

      results.push({
        testName: 'Direct Object Reference (IDOR) Resource Tampering Block',
        category: 'Anti-IDOR Security',
        passed: blockedIdor,
        details: blockedIdor ? 'Successfully caught IDOR attempt to view Tenant B invoice using Tenant A context' : 'VULNERABLE: IDOR allowed cross-tenant object access',
      });
    } catch (e: any) {
      results.push({ testName: 'IDOR Resource Tampering Block', category: 'Anti-IDOR Security', passed: false, details: e.message });
    }

    // Test 4: Branch & GSTIN ID Belonging Validation
    try {
      const t1Gstins = tenantService.getTenantGstins('t1');
      const t2Gstins = tenantService.getTenantGstins('t2');

      const isIsolated = t1Gstins.length > 0 && t2Gstins.length > 0 &&
                         t1Gstins.every((g1) => !t2Gstins.some((g2) => g2.id === g1.id));

      results.push({
        testName: 'GSTIN & Branch Ownership Boundary Isolation Verification',
        category: 'Tenant Isolation',
        passed: isIsolated,
        details: isIsolated ? 'GSTIN and Branch registrations are strictly segregated across tenant namespaces' : 'Failed GSTIN isolation check',
      });
    } catch (e: any) {
      results.push({ testName: 'GSTIN Ownership Isolation', category: 'Tenant Isolation', passed: false, details: e.message });
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      allPassed: failedCount === 0,
      results,
    };
  }
}
