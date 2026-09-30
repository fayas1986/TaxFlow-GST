import { ErpIntegrationAdapter, IntegrationFetchOptions } from './base-adapter.interface';
import { IntegrationProvider } from '@prisma/client';

export class GenericRestAdapter implements ErpIntegrationAdapter {
  provider: IntegrationProvider = IntegrationProvider.GENERIC_REST;

  async fetchRawTransactions(
    apiEndpoint: string,
    decryptedCredentials: any,
    options?: IntegrationFetchOptions,
  ): Promise<any[]> {
    if (!apiEndpoint) {
      throw new Error('Generic REST API endpoint URL is required.');
    }
    // Simulated REST API fetch returning mock raw payload records
    return options?.parameters?.mockPayloads || [];
  }
}
