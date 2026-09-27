/**
 * AI Compliance Assistant & Categorization Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { UsageMetric } from '../../core/usage/types';

export class AiModule {
  public static explainMismatch(ctx: TenantContext, discrepancyDescription: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.AI,
        usageMetricToConsume: { metric: UsageMetric.AI_REQUESTS, amount: 1 },
        auditAction: 'AI_EXPLAIN_MISMATCH',
        auditModule: 'AI'
      },
      () => {
        return {
          explanation: `Automated assessment for ${discrepancyDescription}: Verify supplier filing date in GSTR-1.`,
          confidence: 0.96,
          suggestedAction: 'REQUEST_SUPPLIER_AMENDMENT'
        };
      }
    );
  }
}
