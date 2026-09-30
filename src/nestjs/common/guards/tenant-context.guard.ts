import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  allowedCompanies?: string[];
  allowedGstins?: string[];
}

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // Check JWT payload presence
    if (!user || !user.tenantId) {
      throw new UnauthorizedException('Missing or invalid tenant authentication context.');
    }

    // Extract requested entity IDs from query or body
    const requestedTenantId = request.headers['x-tenant-id'] || request.params.tenantId || request.body?.tenantId;
    const requestedCompanyId = request.params.companyId || request.body?.companyId;

    // Reject browser-supplied tenant header mismatches
    if (requestedTenantId && requestedTenantId !== user.tenantId) {
      throw new ForbiddenException(
        `Cross-tenant access prohibited. Auth tenant '${user.tenantId}' does not match requested tenant '${requestedTenantId}'.`,
      );
    }

    // Attach validated tenant ID strictly from authenticated JWT context
    request.tenantId = user.tenantId;

    if (requestedCompanyId && user.allowedCompanies && !user.allowedCompanies.includes(requestedCompanyId)) {
      throw new ForbiddenException(
        `Company '${requestedCompanyId}' does not belong to authorized tenant '${user.tenantId}'.`,
      );
    }

    return true;
  }
}
