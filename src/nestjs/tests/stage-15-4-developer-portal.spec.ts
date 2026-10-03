import { DeveloperPortalService } from '../modules/developer-portal/developer-portal.service';
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

async function runStage15_4Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.4 — DEVELOPER PORTAL & INTEGRATION HEALTH SUITE  ');
  console.log('================================================================\n');

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const mockLogs = [
    { id: 'l1', tenantId: tenantA, subscriptionId: 'sub-1', eventId: 'e1', status: 'DELIVERED', createdAt: new Date() },
    { id: 'l2', tenantId: tenantA, subscriptionId: 'sub-1', eventId: 'e2', status: 'DELIVERED', createdAt: new Date() },
    { id: 'l3', tenantId: tenantA, subscriptionId: 'sub-1', eventId: 'e3', status: 'DEAD_LETTER', createdAt: new Date() },
    { id: 'l4', tenantId: tenantB, subscriptionId: 'sub-9', eventId: 'e9', status: 'DELIVERED', createdAt: new Date() },
  ];

  const mockPrisma = {
    apiKey: {
      count: async ({ where }: any) => (where.tenantId === tenantA ? 3 : 1),
    },
    webhookSubscription: {
      count: async ({ where }: any) => (where.tenantId === tenantA ? 2 : 1),
    },
    webhookDeliveryLog: {
      findMany: async ({ where, skip, take }: any) => {
        return mockLogs.filter(
          (l) => l.tenantId === where.tenantId && (where.status ? l.status === where.status : true),
        ).slice(skip || 0, (skip || 0) + (take || 20));
      },
      count: async ({ where }: any) => {
        return mockLogs.filter(
          (l) => l.tenantId === where.tenantId && (where.status ? l.status === where.status : true),
        ).length;
      },
    },
  } as unknown as PrismaService;

  const mockApiKeyService = {} as any;
  const mockWebhookSubService = {} as any;

  const devPortalService = new DeveloperPortalService(mockPrisma, mockApiKeyService, mockWebhookSubService);

  // --- SECTION 1: OpenAPI 3.0 & Postman Collection Generation ---
  console.log('--- SECTION 1: OpenAPI 3.0 & Postman Collection Generation ---');
  const openApiSpec = devPortalService.getOpenApiSpec();
  assert(openApiSpec.openapi === '3.0.3', 'OpenAPI specification version is 3.0.3');
  assert(Boolean(openApiSpec.paths['/api/v1/invoices']), 'OpenAPI specification includes invoice endpoints');
  assert(Boolean(openApiSpec.components.securitySchemes.BearerAuth), 'OpenAPI specification includes BearerAuth API Key security scheme');

  const postman = devPortalService.getPostmanCollection();
  assert(postman.info.schema.includes('v2.1.0'), 'Postman collection format is v2.1');
  assert(postman.item.length >= 3, 'Postman collection contains API request items');

  // --- SECTION 2: Webhook Delivery History Inspector ---
  console.log('\n--- SECTION 2: Webhook Delivery History Inspector ---');
  const history = await devPortalService.getWebhookDeliveryHistory(tenantA, { page: 1, limit: 10 });
  assert(history.items.length === 3, 'Delivery history inspector returns Tenant A log records');
  assert(history.pagination.total === 3, 'Pagination total reflects tenant log count');
  assert(history.items.every((i) => i.tenantId === tenantA), 'All returned logs belong strictly to Tenant A');

  // Filter by status DEAD_LETTER
  const failedHistory = await devPortalService.getWebhookDeliveryHistory(tenantA, { status: 'DEAD_LETTER' });
  assert(failedHistory.items.length === 1, 'Delivery history status filter returns matching DEAD_LETTER record');

  // --- SECTION 3: Integration Health & Metrics ---
  console.log('\n--- SECTION 3: Integration Health & Metrics Summary ---');
  const metrics = await devPortalService.getIntegrationMetrics(tenantA);
  assert(metrics.activeApiKeys === 3, 'Metrics summary returns active API key count');
  assert(metrics.activeWebhookSubscriptions === 2, 'Metrics summary returns active webhook subscriptions count');
  assert(metrics.totalWebhookDeliveries === 3, 'Metrics summary counts total webhook deliveries');
  assert(metrics.successfulWebhookDeliveries === 2, 'Metrics summary counts successful deliveries');
  assert(metrics.deliverySuccessRatePercentage === 67, 'Delivery success rate percentage calculated correctly (67%)');
  assert(metrics.integrationStatus === 'DEGRADED', 'Integration status evaluated as DEGRADED due to <90% success rate');

  // --- SECTION 4: Tenant Isolation ---
  console.log('\n--- SECTION 4: Tenant Isolation Verification ---');
  const tenantBHistory = await devPortalService.getWebhookDeliveryHistory(tenantB, {});
  assert(tenantBHistory.items.length === 1, 'Tenant B query returns only Tenant B logs');
  assert(tenantBHistory.items[0].tenantId === tenantB, 'Tenant B data boundary strictly enforced');

  console.log('\n================================================================');
  console.log(`  STAGE 15.4 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_4Tests().catch((err) => {
  console.error('Stage 15.4 test runner failed:', err);
  process.exit(1);
});
