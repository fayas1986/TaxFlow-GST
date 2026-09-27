/**
 * Master TaxFlow Release Candidate (RC) Verification Suite
 * Runs 7 enterprise test suites covering security, tenant isolation, statutory tax vectors,
 * GSP resilience, idempotency, period locking, audit immutability, and negative regression.
 */

import { MultiTenantSecurityTestSuite } from './multiTenantIsolation.test';
import { ServerTenantAuthMiddlewareTestSuite } from './serverTenantAuthMiddleware.test';
import { TaxEngineStatutoryTestSuite } from './taxEngineStatutoryVectors.test';
import { GspProviderFailureRetryTestSuite } from './gspProviderFailureRetry.test';
import { EInvoiceFailureRecoveryTestSuite } from './einvoiceFailureRecovery.test';
import { EndToEndTaxLifecycleTestSuite } from './endToEndTaxLifecycle.test';
import { TenantSecurityNegativeRegressionTestSuite } from './tenantSecurityNegativeRegression.test';

export async function runMasterConvergenceSuite() {
  console.log('====================================================');
  console.log('  TAXFLOW RELEASE CANDIDATE (RC) MASTER VERIFICATION');
  console.log('====================================================\n');

  // 1. Multi-Tenant Isolation
  console.log('[1/7] Running Multi-Tenant Isolation & Anti-IDOR Test Suite...');
  const isolationRes: any = await MultiTenantSecurityTestSuite.runAllTests();
  const isolationTotal = isolationRes.totalTests || isolationRes.totalCount || 27;
  console.log(`      Result: ${isolationRes.passedCount}/${isolationTotal} passed (${isolationRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!isolationRes.allPassed) {
    isolationRes.results.filter((r: any) => r.status !== 'PASSED').forEach((r: any) => console.log(`      - FAIL: ${r.testName || r.name}: ${r.securityVerdict || r.actual}`));
  }
  console.log('');

  // 2. Server Auth & Tenant Middleware
  console.log('[2/7] Running Server Auth & Tenant Middleware Test Suite...');
  const middlewareRes: any = await ServerTenantAuthMiddlewareTestSuite.runAllTests();
  console.log(`      Result: ${middlewareRes.passedCount}/${middlewareRes.totalCount} passed (${middlewareRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!middlewareRes.allPassed) {
    middlewareRes.results.filter((r: any) => !r.passed).forEach((r: any) => console.log(`      - FAIL: ${r.testName || r.name}: ${r.details || r.actual}`));
  }
  console.log('');

  // 3. Tax Engine Statutory Vectors & Rule 42/43
  console.log('[3/7] Running Tax Engine Statutory Vectors & Rule 42/43 Test Suite...');
  const taxEngineRes = await TaxEngineStatutoryTestSuite.runAllTests();
  console.log(`      Result: ${taxEngineRes.passedCount}/${taxEngineRes.totalCount} passed (${taxEngineRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!taxEngineRes.allPassed) {
    taxEngineRes.results.filter(r => !r.passed).forEach(r => console.log(`      - FAIL: ${r.testName}: ${r.details}`));
  }
  console.log('');

  // 4. GSP Provider Security Guards & Failure Recovery
  console.log('[4/7] Running GSP Provider Security Guards & Failure Recovery Test Suite...');
  const gspRes = await GspProviderFailureRetryTestSuite.runAllTests();
  console.log(`      Result: ${gspRes.passedCount}/${gspRes.totalCount} passed (${gspRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!gspRes.allPassed) {
    gspRes.results.filter(r => !r.passed).forEach(r => console.log(`      - FAIL: ${r.testName}: ${r.details}`));
  }
  console.log('');

  // 5. E-Invoice Failure Recovery & Idempotency
  console.log('[5/7] Running E-Invoice Failure Recovery & Idempotency Test Suite...');
  const einvoiceRes = await EInvoiceFailureRecoveryTestSuite.runAllTests();
  console.log(`      Result: ${einvoiceRes.passedCount}/${einvoiceRes.totalCount} passed (${einvoiceRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!einvoiceRes.allPassed) {
    einvoiceRes.results.filter(r => !r.passed).forEach(r => console.log(`      - FAIL: ${r.testName}: ${r.details}`));
  }
  console.log('');

  // 6. End-to-End Tax Lifecycle & Period Locking
  console.log('[6/7] Running End-to-End Tax Lifecycle & Period Locking Test Suite...');
  const lifecycleRes = await EndToEndTaxLifecycleTestSuite.runAllTests();
  console.log(`      Result: ${lifecycleRes.passedCount}/${lifecycleRes.totalCount} passed (${lifecycleRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!lifecycleRes.allPassed) {
    lifecycleRes.results.filter(r => !r.passed).forEach(r => console.log(`      - FAIL: ${r.testName}: ${r.details}`));
  }
  console.log('');

  // 7. Tenant Security Negative Regression
  console.log('[7/7] Running Tenant Security Negative Regression Test Suite...');
  const securityNegRes = await TenantSecurityNegativeRegressionTestSuite.runAllTests();
  console.log(`      Result: ${securityNegRes.passedCount}/${securityNegRes.totalCount} passed (${securityNegRes.allPassed ? 'SUCCESS' : 'FAILED'})`);
  if (!securityNegRes.allPassed) {
    securityNegRes.results.filter(r => !r.passed).forEach(r => console.log(`      - FAIL: ${r.testName}: ${r.details}`));
  }
  console.log('');

  const totalPassed = isolationRes.passedCount + middlewareRes.passedCount + taxEngineRes.passedCount + gspRes.passedCount + einvoiceRes.passedCount + lifecycleRes.passedCount + securityNegRes.passedCount;
  const totalTests = isolationTotal + middlewareRes.totalCount + taxEngineRes.totalCount + gspRes.totalCount + einvoiceRes.totalCount + lifecycleRes.totalCount + securityNegRes.totalCount;
  const overallSuccess = isolationRes.allPassed && middlewareRes.allPassed && taxEngineRes.allPassed && gspRes.allPassed && einvoiceRes.allPassed && lifecycleRes.allPassed && securityNegRes.allPassed;

  console.log('====================================================');
  console.log(`  RELEASE CANDIDATE VERIFICATION: ${totalPassed}/${totalTests} TESTS PASSED`);
  console.log(`  RELEASE STATUS: ${overallSuccess ? 'PASSED (RELEASE CANDIDATE READY)' : 'FAILED'}`);
  console.log('====================================================\n');

  return {
    overallSuccess,
    totalPassed,
    totalTests,
    isolationRes,
    middlewareRes,
    taxEngineRes,
    gspRes,
    einvoiceRes,
    lifecycleRes,
    securityNegRes,
  };
}

// Allow direct CLI execution via tsx
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  runMasterConvergenceSuite().then((res) => {
    if (!res.overallSuccess) {
      process.exit(1);
    }
  });
}
