/**
 * Master TaxFlow Production Convergence Test Runner
 * Executes all 4 enterprise test suites and outputs verification reports.
 */

import { MultiTenantSecurityTestSuite } from './multiTenantIsolation.test';
import { ServerTenantAuthMiddlewareTestSuite } from './serverTenantAuthMiddleware.test';
import { TaxEngineStatutoryTestSuite } from './taxEngineStatutoryVectors.test';
import { GspProviderFailureRetryTestSuite } from './gspProviderFailureRetry.test';

export async function runMasterConvergenceSuite() {
  console.log('====================================================');
  console.log('  TAXFLOW PRODUCTION CONVERGENCE MASTER TEST SUITE  ');
  console.log('====================================================\n');

  // 1. Multi-Tenant Isolation
  console.log('[1/4] Running Multi-Tenant Isolation & Anti-IDOR Test Suite...');
  const isolationRes = await MultiTenantSecurityTestSuite.runAllTests();
  const isolationTotal = isolationRes.totalTests || isolationRes.totalCount || 27;
  console.log(`      Result: ${isolationRes.passedCount}/${isolationTotal} passed (${isolationRes.allPassed ? 'SUCCESS' : 'FAILED'})\n`);

  // 2. Server Auth & Tenant Middleware
  console.log('[2/4] Running Server Auth & Tenant Middleware Test Suite...');
  const middlewareRes = await ServerTenantAuthMiddlewareTestSuite.runAllTests();
  console.log(`      Result: ${middlewareRes.passedCount}/${middlewareRes.totalCount} passed (${middlewareRes.allPassed ? 'SUCCESS' : 'FAILED'})\n`);

  // 3. Tax Engine Statutory Vectors & Rule 42/43
  console.log('[3/4] Running Tax Engine Statutory Vectors & Rule 42/43 Test Suite...');
  const taxEngineRes = await TaxEngineStatutoryTestSuite.runAllTests();
  console.log(`      Result: ${taxEngineRes.passedCount}/${taxEngineRes.totalCount} passed (${taxEngineRes.allPassed ? 'SUCCESS' : 'FAILED'})\n`);

  // 4. GSP Provider Security Guards & Failure Recovery
  console.log('[4/4] Running GSP Provider Security Guards & Failure Recovery Test Suite...');
  const gspRes = await GspProviderFailureRetryTestSuite.runAllTests();
  console.log(`      Result: ${gspRes.passedCount}/${gspRes.totalCount} passed (${gspRes.allPassed ? 'SUCCESS' : 'FAILED'})\n`);

  const totalPassed = isolationRes.passedCount + middlewareRes.passedCount + taxEngineRes.passedCount + gspRes.passedCount;
  const totalTests = isolationTotal + middlewareRes.totalCount + taxEngineRes.totalCount + gspRes.totalCount;
  const overallSuccess = isolationRes.allPassed && middlewareRes.allPassed && taxEngineRes.allPassed && gspRes.allPassed;

  console.log('====================================================');
  console.log(`  CONVERGENCE VERIFICATION COMPLETE: ${totalPassed}/${totalTests} TESTS PASSED`);
  console.log(`  OVERALL STATUS: ${overallSuccess ? 'PASSED (PRODUCTION READY)' : 'FAILED'}`);
  console.log('====================================================\n');

  return {
    overallSuccess,
    totalPassed,
    totalTests,
    isolationRes,
    middlewareRes,
    taxEngineRes,
    gspRes,
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
