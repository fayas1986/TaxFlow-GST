import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IntegrationConnectionService } from './integration-connection.service';
import { AuditService } from '../../audit/audit.service';
import { ERPAdapterRegistryService } from './erp-adapter-registry.service';
import { ERPEntityType, ERPProviderType } from '../interfaces/erp-adapter.interface';

export interface FieldMappingRule {
  canonicalField: string;
  erpField: string;
  direction?: 'INBOUND' | 'OUTBOUND' | 'BOTH';
  required?: boolean;
  transform?: string;
}

export interface IntegrationMappingDto {
  id: string;
  connectionId: string;
  tenantId: string;
  entityType: ERPEntityType;
  version: number;
  isActive: boolean;
  fieldMappings: FieldMappingRule[];
  transformations: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class IntegrationMappingService {
  private readonly logger = new Logger(IntegrationMappingService.name);
  // In-memory lock maintained purely as a local process optimization, NOT sole correctness boundary
  private readonly lockMap = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: IntegrationConnectionService,
    private readonly auditService: AuditService,
    private readonly registry: ERPAdapterRegistryService,
  ) {}

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.lockMap.get(key) || Promise.resolve();
    let release: () => void = () => {};
    const nextLock = new Promise<void>(resolve => { release = resolve; });
    this.lockMap.set(key, (async () => {
      try {
        await currentLock;
      } catch {}
    })().then(() => nextLock));

    try {
      await currentLock;
      return await fn();
    } finally {
      release();
    }
  }

  private async writeOutboxEvent(tenantId: string, eventType: string, aggregateId: string, payload: any) {
    try {
      if ((this.prisma as any).outboxMessage) {
        await (this.prisma as any).outboxMessage.create({
          data: {
            tenantId,
            aggregateType: 'INTEGRATION_MAPPING',
            aggregateId,
            eventType,
            eventVersion: '1.0',
            payload,
            correlationId: `corr-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            status: 'PENDING',
            scheduledAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to write outbox message ${eventType}: ${err.message}`);
    }
  }

  private validateMappingRules(entityType: ERPEntityType, rules: FieldMappingRule[]) {
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      throw new BadRequestException('fieldMappings array cannot be empty');
    }

    if (entityType === 'INVOICE') {
      const mappedCanonicalFields = new Set(rules.map(r => r.canonicalField));
      if (!mappedCanonicalFields.has('invoiceNumber')) {
        throw new BadRequestException('Mapping validation failed: missing required canonical field "invoiceNumber"');
      }
      if (!mappedCanonicalFields.has('totalValue')) {
        throw new BadRequestException('Mapping validation failed: missing required canonical field "totalValue"');
      }
    }
  }

  private async validateConnectionEligibility(tenantId: string, connectionId: string, entityType: ERPEntityType) {
    const conn = await this.connectionService.getConnection(tenantId, connectionId);

    if (conn.state === 'DISABLED' || conn.state === 'AUTH_FAILED') {
      throw new BadRequestException(`Cannot manage mappings for connection '${connectionId}' in state '${conn.state}'`);
    }

    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    const caps = adapter.getCapabilities();

    if (caps.supportedEntities && !caps.supportedEntities.includes(entityType)) {
      throw new BadRequestException(`Provider '${conn.provider}' does not support entity type '${entityType}'`);
    }

    return conn;
  }

  async createMapping(
    tenantId: string,
    connectionId: string,
    entityType: ERPEntityType,
    fieldMappings: FieldMappingRule[],
    transformations: Record<string, any> = {},
  ) {
    const lockKey = `${tenantId}:${connectionId}:${entityType}`;
    return this.withLock(lockKey, async () => {
      await this.validateConnectionEligibility(tenantId, connectionId, entityType);
      this.validateMappingRules(entityType, fieldMappings);

      // Deactivate existing mappings for this connection + entityType
      if ((this.prisma as any).integrationMapping) {
        await (this.prisma as any).integrationMapping.updateMany({
          where: { tenantId, connectionId, entityType },
          data: { isActive: false },
        });
      }

      const record = await (this.prisma as any).integrationMapping.create({
        data: {
          tenantId,
          connectionId,
          entityType,
          version: 1,
          isActive: true,
          fieldMappings,
          transformations,
        },
      });

      await this.auditService.logEvent({
        tenantId,
        userId: 'system-erp-manager',
        action: 'INTEGRATION_MAPPING_CREATED',
        entityType: 'INTEGRATION_MAPPING',
        entityId: record.id,
        newValue: { connectionId, entityType, version: 1, isActive: true },
      }).catch(() => {});

      await this.writeOutboxEvent(tenantId, 'integration.mapping.created', record.id, {
        mappingId: record.id,
        connectionId,
        entityType,
        version: 1,
      });

      return record;
    });
  }

  /**
   * Database-authoritative mapping update with unique-constraint collision retry logic.
   * Authoritative correctness boundary is PostgreSQL @@unique([connectionId, entityType, version]).
   */
  async updateMapping(
    tenantId: string,
    connectionId: string,
    entityType: ERPEntityType,
    fieldMappings: FieldMappingRule[],
    transformations: Record<string, any> = {},
    bypassInProcessLock: boolean = false,
  ) {
    await this.validateConnectionEligibility(tenantId, connectionId, entityType);
    this.validateMappingRules(entityType, fieldMappings);

    const executeUpdate = async () => {
      const maxRetries = 5;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await this.executeMappingUpdateTx(tenantId, connectionId, entityType, fieldMappings, transformations);
        } catch (err: any) {
          const isUniqueCollision =
            err.code === 'P2002' ||
            err.message?.includes('UNIQUE constraint failed') ||
            err.message?.includes('duplicate key') ||
            err.message?.includes('P2002');
          
          if (isUniqueCollision && attempt < maxRetries) {
            this.logger.warn(
              `Mapping version collision detected on ${connectionId}:${entityType}, retrying attempt ${attempt + 1}...`,
            );
            await new Promise(r => setTimeout(r, 15 * attempt));
            continue;
          }
          throw err;
        }
      }
      throw new BadRequestException('Failed to update mapping due to persistent version collision');
    };

    if (bypassInProcessLock) {
      return executeUpdate();
    }

    const lockKey = `${tenantId}:${connectionId}:${entityType}`;
    return this.withLock(lockKey, executeUpdate);
  }

  private async executeMappingUpdateTx(
    tenantId: string,
    connectionId: string,
    entityType: ERPEntityType,
    fieldMappings: FieldMappingRule[],
    transformations: Record<string, any>,
  ) {
    // 1. Fetch current latest version from persistence layer
    const latestMapping = await (this.prisma as any).integrationMapping.findFirst({
      where: { tenantId, connectionId, entityType },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestMapping ? latestMapping.version + 1 : 1;

    // 2. Deactivate previous active mappings in DB
    await (this.prisma as any).integrationMapping.updateMany({
      where: { tenantId, connectionId, entityType },
      data: { isActive: false },
    });

    // 3. Create next version in DB (triggers DB @@unique constraint if version collision occurs)
    const record = await (this.prisma as any).integrationMapping.create({
      data: {
        tenantId,
        connectionId,
        entityType,
        version: nextVersion,
        isActive: true,
        fieldMappings,
        transformations,
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_MAPPING_UPDATED',
      entityType: 'INTEGRATION_MAPPING',
      entityId: record.id,
      newValue: { connectionId, entityType, version: nextVersion, isActive: true },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.mapping.updated', record.id, {
      mappingId: record.id,
      connectionId,
      entityType,
      version: nextVersion,
    });

    return record;
  }

  async getActiveMapping(tenantId: string, connectionId: string, entityType: ERPEntityType) {
    await this.connectionService.getConnection(tenantId, connectionId);

    const mapping = await (this.prisma as any).integrationMapping.findFirst({
      where: { tenantId, connectionId, entityType, isActive: true },
    });

    if (!mapping) {
      throw new NotFoundException(`Active integration mapping for entity '${entityType}' not found on connection '${connectionId}'`);
    }

    return mapping;
  }

  async getMappingVersion(tenantId: string, connectionId: string, entityType: ERPEntityType, version: number) {
    await this.connectionService.getConnection(tenantId, connectionId);

    const mapping = await (this.prisma as any).integrationMapping.findFirst({
      where: { tenantId, connectionId, entityType, version },
    });

    if (!mapping) {
      throw new NotFoundException(`Integration mapping version ${version} for entity '${entityType}' not found on connection '${connectionId}'`);
    }

    return mapping;
  }

  async activateMappingVersion(tenantId: string, connectionId: string, entityType: ERPEntityType, version: number) {
    const lockKey = `${tenantId}:${connectionId}:${entityType}`;
    return this.withLock(lockKey, async () => {
      const targetMapping = await this.getMappingVersion(tenantId, connectionId, entityType, version);

      // Deactivate all versions for entityType
      await (this.prisma as any).integrationMapping.updateMany({
        where: { tenantId, connectionId, entityType },
        data: { isActive: false },
      });

      // Set target version as active
      const updated = await (this.prisma as any).integrationMapping.update({
        where: { id: targetMapping.id },
        data: { isActive: true },
      });

      await this.auditService.logEvent({
        tenantId,
        userId: 'system-erp-manager',
        action: 'INTEGRATION_MAPPING_ACTIVATED',
        entityType: 'INTEGRATION_MAPPING',
        entityId: updated.id,
        newValue: { connectionId, entityType, version, isActive: true },
      }).catch(() => {});

      await this.writeOutboxEvent(tenantId, 'integration.mapping.activated', updated.id, {
        mappingId: updated.id,
        connectionId,
        entityType,
        version,
      });

      return updated;
    });
  }

  async rollbackMapping(tenantId: string, connectionId: string, entityType: ERPEntityType, targetVersion: number) {
    const rolledBack = await this.activateMappingVersion(tenantId, connectionId, entityType, targetVersion);

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_MAPPING_ROLLED_BACK',
      entityType: 'INTEGRATION_MAPPING',
      entityId: rolledBack.id,
      newValue: { connectionId, entityType, targetVersion, isActive: true },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.mapping.rolled_back', rolledBack.id, {
      mappingId: rolledBack.id,
      connectionId,
      entityType,
      targetVersion,
    });

    return rolledBack;
  }

  async deleteMappingVersion(tenantId: string, connectionId: string, entityType: ERPEntityType, version: number) {
    const targetMapping = await this.getMappingVersion(tenantId, connectionId, entityType, version);

    // Check if mapping version was used in integration runs
    let usedCount = 0;
    if ((this.prisma as any).integrationRun) {
      usedCount = await (this.prisma as any).integrationRun.count({
        where: { connectionId, mappingVersion: version },
      });
    }

    if (usedCount > 0) {
      throw new BadRequestException(`Historical mapping version ${version} is immutable and used by existing integration runs`);
    }

    await (this.prisma as any).integrationMapping.delete({
      where: { id: targetMapping.id },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_MAPPING_DELETED',
      entityType: 'INTEGRATION_MAPPING',
      entityId: targetMapping.id,
      newValue: { connectionId, entityType, version },
    }).catch(() => {});

    return { success: true, deletedVersion: version };
  }
}
