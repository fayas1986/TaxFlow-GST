import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executes a database query inside a parameterized RLS-scoped session context.
   * Uses PostgreSQL set_config(setting, value, is_local) with parameterized values
   * to guarantee zero SQL-injection vulnerability.
   */
  async withRlsContext<T>(
    tenantId: string,
    companyId: string | null,
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(tenantId)) {
      throw new Error(`Invalid tenantId format for RLS context: ${tenantId}`);
    }
    if (companyId && !UUID_REGEX.test(companyId)) {
      throw new Error(`Invalid companyId format for RLS context: ${companyId}`);
    }

    return this.$transaction(async (tx) => {
      // Parameterized PostgreSQL set_config call (is_local = true scope transaction only)
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true);`;
      if (companyId) {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true);`;
      }
      return fn(tx);
    });
  }
}

