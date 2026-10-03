import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import * as crypto from 'crypto';

export interface CreateApiKeyDto {
  name: string;
  scopes: string[];
  environment?: 'live' | 'test';
  expiresInDays?: number;
}

export interface ApiKeyCreatedResult {
  id: string;
  name: string;
  keyPrefix: string;
  secretKey: string; // Shown ONCE to user
  scopes: string[];
  environment: string;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  static hashSecret(secretKey: string): string {
    return crypto.createHash('sha256').update(secretKey).digest('hex');
  }

  async createApiKey(tenantId: string, dto: CreateApiKeyDto): Promise<ApiKeyCreatedResult> {
    const env = dto.environment || 'live';
    const prefix = env === 'live' ? 'tf_live_' : 'tf_test_';
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const secretKey = `${prefix}${randomBytes}`;
    const apiKeyHash = ApiKeyService.hashSecret(secretKey);

    let expiresAt: Date | null = null;
    if (dto.expiresInDays && dto.expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);
    }

    const record = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyPrefix: prefix,
        apiKeyHash,
        environment: env,
        scopes: dto.scopes || ['invoices:read'],
        expiresAt,
        status: 'ACTIVE',
      },
    });

    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      secretKey,
      scopes: record.scopes,
      environment: record.environment,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async validateApiKey(secretKey: string, requiredScope?: string): Promise<any> {
    if (!secretKey || typeof secretKey !== 'string') {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const hash = ApiKeyService.hashSecret(secretKey);
    const keyRecord = await this.prisma.apiKey.findUnique({
      where: { apiKeyHash: hash },
    });

    if (!keyRecord) {
      throw new UnauthorizedException('Invalid API Key');
    }

    if (keyRecord.status === 'REVOKED') {
      throw new UnauthorizedException('API Key has been revoked');
    }

    if (keyRecord.status === 'EXPIRED' || (keyRecord.expiresAt && keyRecord.expiresAt < new Date())) {
      throw new UnauthorizedException('API Key has expired');
    }

    if (requiredScope && !keyRecord.scopes.includes(requiredScope) && !keyRecord.scopes.includes('*')) {
      throw new ForbiddenException(`API Key lacks required scope: ${requiredScope}`);
    }

    // Update lastUsedAt asynchronously
    await this.prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return keyRecord;
  }

  async revokeApiKey(tenantId: string, id: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!key) {
      throw new NotFoundException('API Key not found');
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  async listApiKeys(tenantId: string): Promise<any[]> {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        environment: true,
        scopes: true,
        rateLimit: true,
        expiresAt: true,
        lastUsedAt: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
