import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SecurityContext } from './types';

@Injectable()
export class MultiTenantSecurityGuardService {
  /**
   * Enforces strict multi-tenant boundary isolation across all domain queries and payload operations.
   */
  validateTenantAccess(
    context: SecurityContext,
    targetTenantId: string,
    targetCompanyId?: string,
    targetGstinId?: string,
    targetBranchId?: string
  ): void {
    // 1. Tenant Boundary Guard
    if (!context || !context.tenantId) {
      throw new UnauthorizedException('Authentication context missing or unauthenticated.');
    }

    if (targetTenantId && targetTenantId !== context.tenantId) {
      throw new ForbiddenException(
        `Cross-tenant access violation: Auth Tenant [${context.tenantId}] cannot access Target Tenant [${targetTenantId}].`
      );
    }

    // 2. Company Scope Guard
    if (targetCompanyId && context.allowedCompanies && context.allowedCompanies.length > 0) {
      if (!context.allowedCompanies.includes(targetCompanyId)) {
        throw new ForbiddenException(
          `Company boundary violation: Tenant [${context.tenantId}] User [${context.userId}] is not authorized for Company [${targetCompanyId}].`
        );
      }
    }

    // 3. GSTIN Scope Guard
    if (targetGstinId && context.allowedGstins && context.allowedGstins.length > 0) {
      if (!context.allowedGstins.includes(targetGstinId)) {
        throw new ForbiddenException(
          `GSTIN boundary violation: User [${context.userId}] is not authorized for GSTIN [${targetGstinId}].`
        );
      }
    }

    // 4. Branch Scope Guard
    if (targetBranchId && context.allowedBranches && context.allowedBranches.length > 0) {
      if (!context.allowedBranches.includes(targetBranchId)) {
        throw new ForbiddenException(
          `Branch boundary violation: User [${context.userId}] is not authorized for Branch [${targetBranchId}].`
        );
      }
    }
  }

  /**
   * Validates parameter inputs against injection patterns (SQLi, Command Injection, Path Traversal).
   */
  sanitizeAndValidateInput(input: string): void {
    if (!input) return;

    // Path Traversal Check
    if (input.includes('../') || input.includes('..\\')) {
      throw new ForbiddenException('Path traversal attempt detected.');
    }

    // Command Injection Check
    const cmdPatterns = [/;\s*rm\s+/i, /\|\s*bash/i, /`.*`/i, /\$\(.*\)/i];
    for (const pattern of cmdPatterns) {
      if (pattern.test(input)) {
        throw new ForbiddenException('Command injection attempt detected.');
      }
    }

    // SQL Injection Keyword Safeguard (Complementary to Prisma Parameterization)
    const sqliPatterns = [/UNION\s+SELECT/i, /DROP\s+TABLE/i, /INSERT\s+INTO\s+users/i];
    for (const pattern of sqliPatterns) {
      if (pattern.test(input)) {
        throw new ForbiddenException('SQL injection pattern detected.');
      }
    }
  }
}
