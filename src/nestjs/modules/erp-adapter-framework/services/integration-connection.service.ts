import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptographyService } from '../../security/cryptography.service';
import { SsrfGuardService } from '../../webhooks/ssrf-guard.service';
import { AuditService } from '../../audit/audit.service';
import { ERPAdapterRegistryService } from './erp-adapter-registry.service';
import {
  ERPProviderType,
  CanonicalERPInvoiceDto,
  ERPAdapterSyncResult,
  ERPAdapterBatchResult,
  ERPAdapterTestResult,
  ERPAdapterHealthResult,
} from '../interfaces/erp-adapter.interface';

export type ConnectionState = 'CREATED' | 'CONFIGURING' | 'ACTIVE' | 'DEGRADED' | 'AUTH_FAILED' | 'DISABLED';
export type CredentialState = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'ROTATION_REQUIRED' | 'REVOKED';

export interface EntitlementChecker {
  checkConnectionQuota?(tenantId: string): Promise<void>;
}

@Injectable()
export class IntegrationConnectionService {
  private readonly logger = new Logger(IntegrationConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptographyService,
    private readonly ssrfGuard: SsrfGuardService,
    private readonly auditService: AuditService,
    private readonly registry: ERPAdapterRegistryService,
    @Optional() @Inject('ENTITLEMENT_CHECKER') private readonly entitlementChecker?: EntitlementChecker,
  ) {}

  private async writeOutboxEvent(tenantId: string, eventType: string, aggregateId: string, payload: any) {
    try {
      if ((this.prisma as any).outboxMessage) {
        await (this.prisma as any).outboxMessage.create({
          data: {
            tenantId,
            aggregateType: 'INTEGRATION_CONNECTION',
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

  async createConnection(
    tenantId: string,
    provider: ERPProviderType,
    name: string,
    targetUrl?: string,
    plainConfig: Record<string, any> = {},
    environment: string = 'PRODUCTION',
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Connection name is required');
    }
    if (!this.registry.isProviderSupported(provider)) {
      throw new BadRequestException(`Provider type '${provider}' is not registered or supported`);
    }

    // Stage 10 Entitlement Check
    if (this.entitlementChecker?.checkConnectionQuota) {
      await this.entitlementChecker.checkConnectionQuota(tenantId);
    }

    // SSRF Validation for target URL
    if (targetUrl) {
      this.ssrfGuard.validateWebhookUrl(targetUrl);
    }

    // SSRF Validation for dynamic tokenUrl inside plainConfig if present
    if (plainConfig.tokenUrl) {
      this.ssrfGuard.validateWebhookUrl(plainConfig.tokenUrl);
    }

    // Encrypt configuration credentials bound to tenantId AAD
    const encryptedConfig = this.cryptoService.encryptSecretKey(
      JSON.stringify(plainConfig),
      tenantId,
    );

    const record = await this.prisma.erpConnection.create({
      data: {
        tenantId,
        provider,
        name,
        targetUrl: targetUrl || null,
        encryptedConfig,
        status: 'DISCONNECTED',
        state: 'CREATED',
        credentialState: 'ACTIVE',
        environment,
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'ERP_CONNECTION_CREATED',
      entityType: 'ERP_CONNECTION',
      entityId: record.id,
      newValue: { name, provider, status: 'DISCONNECTED', state: 'CREATED', credentialState: 'ACTIVE' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.connection.created', record.id, {
      connectionId: record.id,
      tenantId,
      provider,
      name,
      state: 'CREATED',
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      provider: record.provider,
      name: record.name,
      targetUrl: record.targetUrl,
      status: record.status,
      state: record.state || 'CREATED',
      credentialState: record.credentialState || 'ACTIVE',
      environment: record.environment || environment,
      createdAt: record.createdAt,
    };
  }

  async getConnection(tenantId: string, connectionId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    const conn = await this.prisma.erpConnection.findFirst({
      where: { id: connectionId, tenantId },
    });

    if (!conn) {
      throw new NotFoundException(`ERP Connection '${connectionId}' not found for tenant`);
    }

    return {
      ...conn,
      state: conn.state || (conn.status === 'CONNECTED' ? 'ACTIVE' : conn.status === 'DEGRADED' ? 'DEGRADED' : 'CREATED'),
      credentialState: conn.credentialState || 'ACTIVE',
    };
  }

  async configureConnection(
    tenantId: string,
    connectionId: string,
    updates: { targetUrl?: string; plainConfig?: Record<string, any>; environment?: string },
  ) {
    const conn = await this.getConnection(tenantId, connectionId);

    if (updates.targetUrl) {
      this.ssrfGuard.validateWebhookUrl(updates.targetUrl);
    }
    if (updates.plainConfig?.tokenUrl) {
      this.ssrfGuard.validateWebhookUrl(updates.plainConfig.tokenUrl);
    }

    let encryptedConfig = conn.encryptedConfig;
    if (updates.plainConfig) {
      encryptedConfig = this.cryptoService.encryptSecretKey(
        JSON.stringify(updates.plainConfig),
        tenantId,
      );
    }

    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        targetUrl: updates.targetUrl !== undefined ? updates.targetUrl : conn.targetUrl,
        encryptedConfig,
        state: 'CONFIGURING',
        environment: updates.environment || conn.environment || 'PRODUCTION',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CONNECTION_CONFIGURED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { state: 'CONFIGURING' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.connection.configured', conn.id, {
      connectionId: conn.id,
      state: 'CONFIGURING',
    });

    return {
      ...updated,
      state: 'CONFIGURING',
      credentialState: updated.credentialState || 'ACTIVE',
    };
  }

  async activateConnection(tenantId: string, connectionId: string) {
    const conn = await this.getConnection(tenantId, connectionId);
    const plainConfigStr = this.cryptoService.decryptSecretKey(conn.encryptedConfig, tenantId);
    const config = JSON.parse(plainConfigStr);

    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    let testResult: ERPAdapterTestResult;

    try {
      testResult = await adapter.testConnection(config);
    } catch (err: any) {
      testResult = { success: false, latencyMs: 0, message: err.message };
    }

    const newState: ConnectionState = testResult.success ? 'ACTIVE' : 'AUTH_FAILED';
    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        status: testResult.success ? 'CONNECTED' : 'ERROR',
        state: newState,
        lastHealthCheckAt: new Date(),
      },
    });

    const eventAction = testResult.success ? 'INTEGRATION_CONNECTION_ACTIVATED' : 'INTEGRATION_CONNECTION_AUTH_FAILED';
    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: eventAction,
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { state: newState, success: testResult.success },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, testResult.success ? 'integration.connection.activated' : 'integration.connection.auth_failed', conn.id, {
      connectionId: conn.id,
      state: newState,
    });

    return {
      ...updated,
      state: newState,
      credentialState: updated.credentialState || 'ACTIVE',
    };
  }

  async markDegraded(tenantId: string, connectionId: string, reason?: string) {
    const conn = await this.getConnection(tenantId, connectionId);
    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        status: 'DEGRADED',
        state: 'DEGRADED',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CONNECTION_DEGRADED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { state: 'DEGRADED', reason },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.connection.degraded', conn.id, {
      connectionId: conn.id,
      state: 'DEGRADED',
      reason,
    });

    return {
      ...updated,
      state: 'DEGRADED',
      credentialState: updated.credentialState || 'ACTIVE',
    };
  }

  async restoreActive(tenantId: string, connectionId: string) {
    const conn = await this.getConnection(tenantId, connectionId);
    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        status: 'CONNECTED',
        state: 'ACTIVE',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CONNECTION_RESTORED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { state: 'ACTIVE' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.connection.activated', conn.id, {
      connectionId: conn.id,
      state: 'ACTIVE',
    });

    return {
      ...updated,
      state: 'ACTIVE',
      credentialState: updated.credentialState || 'ACTIVE',
    };
  }

  async disableConnection(tenantId: string, connectionId: string) {
    const conn = await this.getConnection(tenantId, connectionId);
    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        status: 'DISCONNECTED',
        state: 'DISABLED',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CONNECTION_DISABLED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { state: 'DISABLED' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.connection.disabled', conn.id, {
      connectionId: conn.id,
      state: 'DISABLED',
    });

    return {
      ...updated,
      state: 'DISABLED',
      credentialState: updated.credentialState || 'ACTIVE',
    };
  }

  async enableConnection(tenantId: string, connectionId: string) {
    const conn = await this.getConnection(tenantId, connectionId);
    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        state: 'CONFIGURING',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CONNECTION_ENABLED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { state: 'CONFIGURING' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.connection.enabled', conn.id, {
      connectionId: conn.id,
      state: 'CONFIGURING',
    });

    return {
      ...updated,
      state: 'CONFIGURING',
      credentialState: updated.credentialState || 'ACTIVE',
    };
  }

  async rotateCredentials(tenantId: string, connectionId: string, newConfig: Record<string, any>) {
    const conn = await this.getConnection(tenantId, connectionId);

    if (newConfig.tokenUrl) {
      this.ssrfGuard.validateWebhookUrl(newConfig.tokenUrl);
    }
    if (newConfig.targetUrl) {
      this.ssrfGuard.validateWebhookUrl(newConfig.targetUrl);
    }

    const encryptedConfig = this.cryptoService.encryptSecretKey(
      JSON.stringify(newConfig),
      tenantId,
    );

    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    let testResult: ERPAdapterTestResult;
    try {
      testResult = await adapter.testConnection(newConfig);
    } catch (err: any) {
      testResult = { success: false, latencyMs: 0, message: err.message };
    }

    const newCredState: CredentialState = testResult.success ? 'ACTIVE' : 'ROTATION_REQUIRED';
    const newConnState: ConnectionState = testResult.success ? 'ACTIVE' : 'AUTH_FAILED';

    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        encryptedConfig,
        credentialState: newCredState,
        state: newConnState,
        status: testResult.success ? 'CONNECTED' : 'ERROR',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CREDENTIAL_ROTATED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { credentialState: newCredState, state: newConnState },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.credential.rotated', conn.id, {
      connectionId: conn.id,
      credentialState: newCredState,
      state: newConnState,
    });

    return {
      ...updated,
      state: newConnState,
      credentialState: newCredState,
    };
  }

  async checkCredentialExpiry(tenantId: string, connectionId: string, options: { expiresAt?: string; thresholdDays?: number } = {}) {
    const conn = await this.getConnection(tenantId, connectionId);
    const thresholdDays = options.thresholdDays || 7;
    let newCredState: CredentialState = conn.credentialState || 'ACTIVE';
    let newConnState: ConnectionState = conn.state || 'ACTIVE';

    if (options.expiresAt) {
      const expDate = new Date(options.expiresAt).getTime();
      const now = Date.now();
      const thresholdMs = thresholdDays * 86400 * 1000;

      if (expDate <= now) {
        newCredState = 'EXPIRED';
        newConnState = 'AUTH_FAILED';
      } else if (expDate - now <= thresholdMs) {
        newCredState = 'EXPIRING';
      }
    }

    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        credentialState: newCredState,
        state: newConnState,
        status: newConnState === 'AUTH_FAILED' ? 'ERROR' : conn.status,
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CREDENTIAL_EXPIRY_CHECKED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { credentialState: newCredState, state: newConnState },
    }).catch(() => {});

    return {
      ...updated,
      state: newConnState,
      credentialState: newCredState,
    };
  }

  async revokeCredentials(tenantId: string, connectionId: string) {
    const conn = await this.getConnection(tenantId, connectionId);

    const updated = await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        credentialState: 'REVOKED',
        state: 'DISABLED',
        status: 'DISCONNECTED',
      },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'INTEGRATION_CREDENTIAL_REVOKED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { credentialState: 'REVOKED', state: 'DISABLED' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.credential.revoked', conn.id, {
      connectionId: conn.id,
      credentialState: 'REVOKED',
      state: 'DISABLED',
    });

    return {
      ...updated,
      state: 'DISABLED',
      credentialState: 'REVOKED',
    };
  }

  // --- Legacy & Existing Methods (Maintained for Backward Compatibility) ---

  async connect(tenantId: string, connectionId: string): Promise<boolean> {
    const conn = await this.getConnection(tenantId, connectionId);
    const plainConfigStr = this.cryptoService.decryptSecretKey(conn.encryptedConfig, tenantId);
    const config = JSON.parse(plainConfigStr);

    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    const connected = await adapter.connect(config);

    const newStatus = connected ? 'CONNECTED' : 'ERROR';
    const newState: ConnectionState = connected ? 'ACTIVE' : 'AUTH_FAILED';

    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: { status: newStatus, state: newState },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'ERP_CONNECTION_ESTABLISHED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { status: newStatus, state: newState },
    }).catch(() => {});

    return connected;
  }

  async disconnect(tenantId: string, connectionId: string): Promise<boolean> {
    const conn = await this.getConnection(tenantId, connectionId);
    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    const disconnected = await adapter.disconnect(connectionId);

    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: { status: 'DISCONNECTED', state: 'DISABLED' },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'ERP_CONNECTION_DISCONNECTED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { status: 'DISCONNECTED', state: 'DISABLED' },
    }).catch(() => {});

    return disconnected;
  }

  async testConnection(tenantId: string, connectionId: string): Promise<ERPAdapterTestResult> {
    const conn = await this.getConnection(tenantId, connectionId);
    const plainConfigStr = this.cryptoService.decryptSecretKey(conn.encryptedConfig, tenantId);
    const config = JSON.parse(plainConfigStr);

    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    const result = await adapter.testConnection(config);

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-manager',
      action: 'ERP_CONNECTION_TESTED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { success: result.success, latencyMs: result.latencyMs },
    }).catch(() => {});

    return result;
  }

  async runHealthCheck(tenantId: string, connectionId: string): Promise<ERPAdapterHealthResult> {
    const conn = await this.getConnection(tenantId, connectionId);
    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);
    const health = await adapter.healthCheck();

    const newStatus = health.status === 'HEALTHY' ? 'CONNECTED' : health.status === 'DEGRADED' ? 'DEGRADED' : 'ERROR';
    const newState: ConnectionState = health.status === 'HEALTHY' ? 'ACTIVE' : health.status === 'DEGRADED' ? 'DEGRADED' : 'AUTH_FAILED';

    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        status: newStatus,
        state: newState,
        lastHealthCheckAt: new Date(),
      },
    });

    return health;
  }

  async pushRecord(tenantId: string, connectionId: string, payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult> {
    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Tenant isolation violation: payload tenantId mismatch');
    }

    const conn = await this.getConnection(tenantId, connectionId);
    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);

    if (!adapter.getCapabilities().supportsOutbound) {
      throw new BadRequestException(`Provider '${conn.provider}' does not support outbound push sync`);
    }

    const result = await adapter.push(payload);

    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date() },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-worker',
      action: result.success ? 'ERP_SYNC_SUCCESS' : 'ERP_SYNC_FAILED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { invoiceNumber: payload.invoiceNumber, externalId: result.externalId, status: result.status },
    }).catch(() => {});

    return result;
  }

  async syncBatch(tenantId: string, connectionId: string, batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    for (const item of batch) {
      if (item.tenantId !== tenantId) {
        throw new UnauthorizedException(`Tenant isolation violation: record ${item.invoiceNumber} tenantId mismatch`);
      }
    }

    const conn = await this.getConnection(tenantId, connectionId);
    const adapter = this.registry.getAdapter(conn.provider as ERPProviderType);

    if (!adapter.getCapabilities().supportsBatchSync) {
      throw new BadRequestException(`Provider '${conn.provider}' does not support batch sync`);
    }

    const batchResult = await adapter.sync(batch);

    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date() },
    });

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-erp-worker',
      action: 'ERP_BATCH_SYNC_EXECUTED',
      entityType: 'ERP_CONNECTION',
      entityId: conn.id,
      newValue: { total: batchResult.totalRecords, synced: batchResult.syncedCount, failed: batchResult.failedCount },
    }).catch(() => {});

    return batchResult;
  }
}
