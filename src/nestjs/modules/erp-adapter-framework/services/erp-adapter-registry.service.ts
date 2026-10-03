import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import {
  IntegrationAdapter,
  ERPProviderType,
  ERPAdapterCapabilities,
} from '../interfaces/erp-adapter.interface';

@Injectable()
export class ERPAdapterRegistryService {
  private readonly logger = new Logger(ERPAdapterRegistryService.name);
  private readonly adapters = new Map<ERPProviderType, IntegrationAdapter>();

  registerAdapter(adapter: IntegrationAdapter): void {
    if (!adapter || !adapter.providerType) {
      throw new BadRequestException('Invalid ERP adapter registration: missing providerType');
    }
    this.adapters.set(adapter.providerType, adapter);
    this.logger.log(`Registered ERP Adapter for provider: ${adapter.providerType}`);
  }

  getAdapter(providerType: ERPProviderType): IntegrationAdapter {
    const adapter = this.adapters.get(providerType);
    if (!adapter) {
      throw new NotFoundException(`No ERP adapter registered for provider type: '${providerType}'`);
    }
    return adapter;
  }

  getCapabilities(providerType: ERPProviderType): ERPAdapterCapabilities {
    const adapter = this.getAdapter(providerType);
    return adapter.getCapabilities();
  }

  getCapabilityMatrix(): Record<string, ERPAdapterCapabilities> {
    const matrix: Record<string, ERPAdapterCapabilities> = {};
    for (const [type, adapter] of this.adapters.entries()) {
      matrix[type] = adapter.getCapabilities();
    }
    return matrix;
  }

  listSupportedProviders(): ERPProviderType[] {
    return Array.from(this.adapters.keys());
  }

  isProviderSupported(providerType: string): boolean {
    return this.adapters.has(providerType as ERPProviderType);
  }
}
