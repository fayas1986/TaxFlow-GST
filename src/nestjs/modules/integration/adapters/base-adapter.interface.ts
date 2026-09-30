import { IntegrationProvider } from '@prisma/client';

export interface IntegrationFetchOptions {
  startDate?: Date;
  endDate?: Date;
  batchSize?: number;
  parameters?: Record<string, any>;
}

export interface ErpIntegrationAdapter {
  provider: IntegrationProvider;
  fetchRawTransactions(apiEndpoint: string, decryptedCredentials: any, options?: IntegrationFetchOptions): Promise<any[]>;
}
