import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import * as crypto from 'crypto';

export interface IdempotencyCheckResult {
  isCached: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: any;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  static computeRequestHash(method: string, path: string, body: any): string {
    const serializedBody = body ? JSON.stringify(body) : '';
    const payload = `${method.toUpperCase()}:${path}:${serializedBody}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async lockOrRetrieve(
    tenantId: string,
    idempotencyKey: string,
    endpointPath: string,
    method: string,
    requestBody: any,
  ): Promise<IdempotencyCheckResult> {
    const requestHash = IdempotencyService.computeRequestHash(method, endpointPath, requestBody);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours TTL

    // 1. Check existing idempotency record
    const existing = await this.prisma.apiIdempotencyRecord.findUnique({
      where: {
        tenantId_idempotencyKey_endpointPath: {
          tenantId,
          idempotencyKey,
          endpointPath,
        },
      },
    });

    if (existing) {
      // Payload mismatch check
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: `Idempotency-Key '${idempotencyKey}' was previously used with a different request payload fingerprint.`,
        });
      }

      if (existing.status === 'IN_PROGRESS') {
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: `A request with Idempotency-Key '${idempotencyKey}' is currently being processed.`,
        });
      }

      if (existing.status === 'SUCCEEDED') {
        return {
          isCached: true,
          status: existing.responseStatus,
          headers: (existing.responseHeaders as Record<string, string>) || {},
          body: existing.responseBody,
        };
      }
    }

    // 2. Persist IN_PROGRESS state relying on DB unique constraint for concurrency safety
    try {
      await this.prisma.apiIdempotencyRecord.create({
        data: {
          tenantId,
          idempotencyKey,
          endpointPath,
          requestHash,
          responseStatus: 0,
          responseBody: {},
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
    } catch (err: any) {
      // Concurrent duplicate request race condition hit database constraint
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONCURRENT_RACE',
        message: `Concurrent request with Idempotency-Key '${idempotencyKey}' detected. Request rejected.`,
      });
    }

    return { isCached: false };
  }

  async saveResponse(
    tenantId: string,
    idempotencyKey: string,
    endpointPath: string,
    responseStatus: number,
    responseBody: any,
    responseHeaders?: Record<string, string>,
  ): Promise<void> {
    await this.prisma.apiIdempotencyRecord.update({
      where: {
        tenantId_idempotencyKey_endpointPath: {
          tenantId,
          idempotencyKey,
          endpointPath,
        },
      },
      data: {
        responseStatus,
        responseHeaders: responseHeaders || {},
        responseBody: responseBody || {},
        status: 'SUCCEEDED',
      },
    });
  }

  async unlockOnFailure(tenantId: string, idempotencyKey: string, endpointPath: string): Promise<void> {
    await this.prisma.apiIdempotencyRecord.delete({
      where: {
        tenantId_idempotencyKey_endpointPath: {
          tenantId,
          idempotencyKey,
          endpointPath,
        },
      },
    }).catch(() => {});
  }
}
