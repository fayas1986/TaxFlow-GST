import { ErpIntegrationAdapter, IntegrationFetchOptions } from './base-adapter.interface';
import { IntegrationProvider } from '@prisma/client';

export class CsvExcelImportAdapter implements ErpIntegrationAdapter {
  provider: IntegrationProvider = IntegrationProvider.CSV_EXCEL;

  async fetchRawTransactions(
    apiEndpoint: string,
    decryptedCredentials: any,
    options?: IntegrationFetchOptions,
  ): Promise<any[]> {
    const rawFileContent = options?.parameters?.fileContent;
    if (typeof rawFileContent === 'string') {
      return this.parseCsv(rawFileContent);
    }
    return options?.parameters?.parsedRows || [];
  }

  private parseCsv(csvText: string): any[] {
    const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] !== undefined ? values[idx] : '';
      });
      records.push(obj);
    }
    return records;
  }
}
