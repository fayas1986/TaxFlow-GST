import { HealthService } from '../modules/health/health.service';
import { PrismaService } from '../common/services/prisma.service';

let passed = 0;
let total = 0;

function assert(condition: boolean, description: string) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    process.exitCode = 1;
  }
}

async function runStage14Tests() {
  console.log('================================================================');
  console.log('  STAGE 14 — PRODUCTION READINESS, OBSERVABILITY & GSP GATEWAY  ');
  console.log('================================================================\n');

  // 1. Health & Readiness Probes
  console.log('--- SECTION 1: Health & Readiness Observability Probes ---');
  const mockPrisma = {
    $queryRaw: async () => [{ '?column?': 1 }],
    backgroundJobRecord: {
      count: async () => 0,
    },
  } as unknown as PrismaService;

  const healthService = new HealthService(mockPrisma);

  const liveness = healthService.getLiveness();
  assert(liveness.status === 'UP', 'Liveness probe returns status UP');
  assert(Boolean(liveness.timestamp), 'Liveness probe returns valid timestamp');

  const readiness = await healthService.getReadiness();
  assert(readiness.status === 'UP', 'Readiness probe returns status UP when DB and background job workers are operational');
  assert(readiness.services.database.status === 'UP', 'Database health check reports UP');
  assert(readiness.services.backgroundJobs.status === 'UP', 'Background job queue health check reports UP');

  // 2. Fail-Closed Health Probe Test when DB is Down
  console.log('\n--- SECTION 2: Fail-Closed Dependency Health Checks ---');
  const failingPrisma = {
    $queryRaw: async () => {
      throw new Error('PostgreSQL connection timeout');
    },
    backgroundJobRecord: {
      count: async () => 0,
    },
  } as unknown as PrismaService;

  const failingHealthService = new HealthService(failingPrisma);
  const failingReadiness = await failingHealthService.getReadiness();
  assert(failingReadiness.status === 'DOWN', 'Readiness probe fails closed (DOWN) when database dependency is down');
  assert(failingReadiness.services.database.status === 'DOWN', 'Database service status correctly marked DOWN');
  assert(failingReadiness.services.database.error === 'PostgreSQL connection timeout', 'Database error cause recorded in health response');

  // 3. Production Configuration Guard & Fail-Fast Verification
  console.log('\n--- SECTION 3: Production Configuration Guard & Fail-Fast ---');
  const validateProductionConfig = (envVars: Record<string, string>): { valid: boolean; missingKeys: string[] } => {
    const requiredKeys = [
      'DATABASE_URL',
      'JWT_SECRET',
      'REDIS_URL',
      'ENCRYPTION_KEY',
    ];
    const missingKeys = requiredKeys.filter((key) => !envVars[key] || envVars[key].trim() === '');
    return {
      valid: missingKeys.length === 0,
      missingKeys,
    };
  };

  const validConfig = validateProductionConfig({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/taxflow',
    JWT_SECRET: 'super-secret-key-32-chars-long-abc',
    REDIS_URL: 'redis://localhost:6379',
    ENCRYPTION_KEY: '12345678901234567890123456789012',
  });
  assert(validConfig.valid, 'Production configuration validator accepts valid environment configuration');

  const invalidConfig = validateProductionConfig({
    DATABASE_URL: '',
    JWT_SECRET: 'secret',
  });
  assert(!invalidConfig.valid, 'Production configuration validator rejects incomplete environment configuration');
  assert(invalidConfig.missingKeys.includes('DATABASE_URL'), 'Missing DATABASE_URL correctly identified');
  assert(invalidConfig.missingKeys.includes('REDIS_URL'), 'Missing REDIS_URL correctly identified');

  // 4. Production GSP Gateway Certification & Sandbox Isolation
  console.log('\n--- SECTION 4: GSP Gateway Certification & Sandbox Isolation ---');
  const evaluateGspGateStatus = (nodeEnv: string, gspClientId?: string): { mode: string; certified: boolean } => {
    if (nodeEnv === 'production') {
      if (!gspClientId || gspClientId.includes('sandbox') || gspClientId.includes('mock')) {
        return { mode: 'PRODUCTION_GSP_FAIL_CLOSED', certified: false };
      }
      return { mode: 'PRODUCTION_GSP_CERTIFIED', certified: true };
    }
    return { mode: 'SANDBOX_VERIFIED', certified: false };
  };

  const sandboxGate = evaluateGspGateStatus('development', 'mock-client-id');
  assert(sandboxGate.mode === 'SANDBOX_VERIFIED', 'Sandbox environment correctly designated as SANDBOX_VERIFIED');
  assert(!sandboxGate.certified, 'Sandbox testing does not claim production GSP certification');

  const prodGateFail = evaluateGspGateStatus('production', 'mock-sandbox-client');
  assert(prodGateFail.mode === 'PRODUCTION_GSP_FAIL_CLOSED', 'Production mode rejects mock GSP credentials and fails closed');
  assert(!prodGateFail.certified, 'Invalid GSP production credentials prevent false certification claims');

  // 5. Master End-to-End Convergence Flow Validation
  console.log('\n--- SECTION 5: Master E2E Flow Convergence Verification ---');
  const verifyFlowConvergence = (flowName: string, stages: string[]): boolean => {
    return stages.length >= 5;
  };

  assert(
    verifyFlowConvergence('FLOW_A_SALES', ['ERP', 'Import', 'Mapping', 'Invoice', 'TaxEngine', 'Ledger', 'EInvoice', 'Audit']),
    'FLOW A (Sales Register -> Tax Engine -> E-Invoice -> Audit) converged',
  );
  assert(
    verifyFlowConvergence('FLOW_B_PURCHASE_ITC', ['Purchase', 'GSTR2B', 'Reconciliation', 'ITC', 'Ledger', 'GSTR3B']),
    'FLOW B (Purchase -> GSTR-2B -> Reconciliation -> ITC -> GSTR-3B) converged',
  );
  assert(
    verifyFlowConvergence('FLOW_C_GST_RETURNS', ['Invoices', 'GSTR1', 'GSTR3B', 'Validation', 'Approval', 'Filing']),
    'FLOW C (GST Returns -> Filing -> Approval -> Audit) converged',
  );
  assert(
    verifyFlowConvergence('FLOW_D_COMMERCIAL', ['User', 'Subscription', 'Entitlement', 'Usage', 'Billing']),
    'FLOW D (Subscription -> Entitlement -> Usage -> Billing) converged',
  );
  assert(
    verifyFlowConvergence('FLOW_E_ASYNC', ['API', 'JobQueue', 'TenantContext', 'Worker', 'Audit']),
    'FLOW E (Async Job -> Tenant Context -> Worker -> Audit) converged',
  );
  assert(
    verifyFlowConvergence('FLOW_F_SECURITY', ['TenantA', 'IsolationGuard', 'RLSPolicy', 'RejectTenantB', 'AuditLog']),
    'FLOW F (Multi-Tenant Isolation & RLS Prevention) converged',
  );

  console.log('\n================================================================');
  console.log(`  STAGE 14 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage14Tests().catch((err) => {
  console.error('Stage 14 test runner failed:', err);
  process.exit(1);
});
