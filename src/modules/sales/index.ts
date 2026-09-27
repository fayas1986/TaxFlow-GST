/**
 * Outward Sales Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { createTenantDatabaseClient, ScopedInvoice } from '../../infrastructure/database/repositories';

export class SalesModule {
  public static getSalesRegister(ctx: TenantContext): ScopedInvoice[] {
    // Uses the HOF tenant database client, automatically scoped to ctx.tenantId
    const db = createTenantDatabaseClient(ctx);
    return db.invoices.findMany({
      where: {
        status: (val: any) => val !== 'CANCELLED'
      }
    });
  }
}

