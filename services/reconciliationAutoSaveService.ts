import {
  PurchaseInvoiceInput,
  ReconciliationAssistantSummary
} from './reconciliationAssistantService';
import {
  GSTR2BMatchingConfig,
  GSTR2BMatchResultItem,
  GSTR2BPortalRecord
} from './gstEngine/gstr2bMatchingService';

export interface ReconciliationDraftData {
  version: number;
  tenantGstin: string;
  tenantName: string;
  returnPeriod: string;
  currentStep: number;
  purchaseInvoices: PurchaseInvoiceInput[];
  gstr2bRecords: GSTR2BPortalRecord[];
  purchasesFileName: string | null;
  gstr2bFileName: string | null;
  config: GSTR2BMatchingConfig;
  results: GSTR2BMatchResultItem[];
  summary: ReconciliationAssistantSummary | null;
  acceptedOverrides: [string, string][];
  heldPaymentIds: string[];
  deferredIds: string[];
  noticeSentIds: string[];
  lastSavedAt: string;
  savedTimestamp: number;
  itemCount: number;
}

const STORAGE_PREFIX = 'taxflow_reconciliation_draft_';

export class ReconciliationAutoSaveService {
  private static getStorageKey(tenantGstin: string, period: string): string {
    const sanitizedGstin = (tenantGstin || 'default').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedPeriod = (period || 'current').replace(/[^a-zA-Z0-9]/g, '_');
    return `${STORAGE_PREFIX}${sanitizedGstin}_${sanitizedPeriod}`;
  }

  /**
   * Saves reconciliation assistant progress into local storage
   */
  public static saveDraft(
    tenantGstin: string,
    period: string,
    data: Omit<ReconciliationDraftData, 'version' | 'lastSavedAt' | 'savedTimestamp' | 'itemCount'>
  ): { success: boolean; timestamp: string; sizeKb: number; error?: string } {
    try {
      const key = this.getStorageKey(tenantGstin, period);
      const now = new Date();
      const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const fullDraft: ReconciliationDraftData = {
        ...data,
        version: 1,
        lastSavedAt: timestampStr,
        savedTimestamp: now.getTime(),
        itemCount: (data.purchaseInvoices?.length || 0) + (data.gstr2bRecords?.length || 0)
      };

      const serialized = JSON.stringify(fullDraft);
      const sizeKb = Math.round((serialized.length * 2) / 1024);

      try {
        localStorage.setItem(key, serialized);
        localStorage.setItem(`${STORAGE_PREFIX}latest_key`, key);
      } catch (storageErr: any) {
        // If quota exceeded due to large volume of invoices, save without raw items or compact format
        if (storageErr?.name === 'QuotaExceededError' || storageErr?.code === 22) {
          console.warn('Storage quota exceeded, storing trimmed progress draft...');
          const trimmedDraft: ReconciliationDraftData = {
            ...fullDraft,
            purchaseInvoices: fullDraft.purchaseInvoices.slice(0, 500),
            gstr2bRecords: fullDraft.gstr2bRecords.slice(0, 500),
            results: fullDraft.results.slice(0, 500)
          };
          localStorage.setItem(key, JSON.stringify(trimmedDraft));
        } else {
          throw storageErr;
        }
      }

      return {
        success: true,
        timestamp: timestampStr,
        sizeKb
      };
    } catch (err: any) {
      console.error('Failed to auto-save reconciliation draft to localStorage:', err);
      return {
        success: false,
        timestamp: '',
        sizeKb: 0,
        error: err?.message || 'Storage error'
      };
    }
  }

  /**
   * Loads a saved reconciliation draft
   */
  public static loadDraft(tenantGstin: string, period: string): ReconciliationDraftData | null {
    try {
      const key = this.getStorageKey(tenantGstin, period);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed: ReconciliationDraftData = JSON.parse(raw);
      return parsed;
    } catch (err) {
      console.error('Failed to load reconciliation draft from localStorage:', err);
      return null;
    }
  }

  /**
   * Checks if a saved draft exists
   */
  public static hasDraft(tenantGstin: string, period: string): boolean {
    const key = this.getStorageKey(tenantGstin, period);
    return Boolean(localStorage.getItem(key));
  }

  /**
   * Clears a saved draft
   */
  public static clearDraft(tenantGstin: string, period: string): void {
    try {
      const key = this.getStorageKey(tenantGstin, period);
      localStorage.removeItem(key);
    } catch (err) {
      console.error('Failed to remove draft from localStorage:', err);
    }
  }

  /**
   * Lists all existing drafts
   */
  public static listDrafts(): Array<{ key: string; period: string; tenantGstin: string; lastSavedAt: string; itemCount: number; step: number }> {
    const drafts: Array<{ key: string; period: string; tenantGstin: string; lastSavedAt: string; itemCount: number; step: number }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX) && !k.endsWith('latest_key')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const d = JSON.parse(raw);
              drafts.push({
                key: k,
                period: d.returnPeriod || 'Unknown',
                tenantGstin: d.tenantGstin || 'Unknown',
                lastSavedAt: d.lastSavedAt || '',
                itemCount: d.itemCount || 0,
                step: d.currentStep || 1
              });
            } catch (e) {
              // ignore malformed
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to list drafts', e);
    }
    return drafts;
  }
}
