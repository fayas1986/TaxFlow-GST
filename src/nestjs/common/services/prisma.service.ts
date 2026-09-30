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
   * Executes a database query inside an RLS-scoped session context.
   */
  async withRlsContext<T>(
    tenantId: string,
    companyId: string | null,
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`);
      if (companyId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id = '${companyId}';`);
      }
      return fn(tx);
    });
  }
}
