import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId || request.user?.tenantId;
    const companyId = request.params?.companyId || request.body?.companyId || null;

    if (tenantId) {
      // Set session variables for RLS defense in depth
      await this.prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`);
      if (companyId) {
        await this.prisma.$executeRawUnsafe(`SET LOCAL app.current_company_id = '${companyId}';`);
      }
    }

    return next.handle();
  }
}
