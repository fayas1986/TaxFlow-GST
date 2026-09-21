import Dexie, { Table } from 'dexie';

export interface LocalDraft {
  id: string;
  type: 'INVOICE' | 'DOCUMENT';
  data: any;
  updatedAt: string;
  synced: boolean;
}

export class AppLocalDatabase extends Dexie {
  drafts!: Table<LocalDraft>;

  constructor() {
    super('TaxFlowOfflineDB');
    this.version(1).stores({
      drafts: 'id, type, updatedAt, synced' // primary key and indexed props
    });
  }
}

export const localDb = new AppLocalDatabase();
