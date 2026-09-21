import { useState, useEffect, useCallback } from 'react';
import {
  getLedgerExportPolicy,
  saveLedgerExportPolicy,
  getLedgerArchiveHistory,
  checkAndRunAutomatedMonthlyExport,
  generateConsolidatedLedgerData,
  triggerSecureLocalDownload,
  LedgerExportPolicy,
  LedgerArchiveRecord,
  getCurrentExportPeriod
} from '../utils/automatedLedgerExport';

export function useAutomatedLedgerExport(tenantId = 't1', tenantName?: string, gstin?: string) {
  const [policy, setPolicy] = useState<LedgerExportPolicy>(getLedgerExportPolicy());
  const [history, setHistory] = useState<LedgerArchiveRecord[]>(getLedgerArchiveHistory());
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportStatus, setLastExportStatus] = useState<{
    success: boolean;
    message: string;
    filename?: string;
    hash?: string;
  } | null>(null);

  // Refresh policy and history
  const refresh = useCallback(() => {
    setPolicy(getLedgerExportPolicy());
    setHistory(getLedgerArchiveHistory());
  }, []);

  // Update policy
  const updatePolicy = useCallback((updates: Partial<LedgerExportPolicy>) => {
    const updated = saveLedgerExportPolicy(updates);
    setPolicy(updated);
    return updated;
  }, []);

  // Trigger immediate export and secure local download
  const triggerExport = useCallback(async (customFormat?: 'JSON' | 'EXCEL' | 'CSV', period?: string) => {
    setIsExporting(true);
    setLastExportStatus(null);
    try {
      const exportPeriod = period || getCurrentExportPeriod();
      const archive = await generateConsolidatedLedgerData({
        tenantId,
        tenantName,
        gstin,
        period: exportPeriod
      });

      const chosenFormat = customFormat || policy.format || 'JSON';
      const result = await triggerSecureLocalDownload(archive, chosenFormat);

      refresh();
      setLastExportStatus({
        success: true,
        message: `Archived & Downloaded ${result.filename}`,
        filename: result.filename,
        hash: result.sha256Hash
      });
      return result;
    } catch (err: any) {
      console.error('Ledger export failed:', err);
      setLastExportStatus({
        success: false,
        message: err.message || 'Failed to generate compliance ledger archive'
      });
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [tenantId, tenantName, gstin, policy.format, refresh]);

  // Run scheduled automated check on mount if enabled
  useEffect(() => {
    let isMounted = true;
    const runAutoCheck = async () => {
      const pol = getLedgerExportPolicy();
      if (!pol.enabled || !pol.autoDownload) return;

      try {
        const result = await checkAndRunAutomatedMonthlyExport(tenantId, {
          tenantName,
          gstin
        });

        if (isMounted && result.executed) {
          refresh();
          setLastExportStatus({
            success: true,
            message: `Automated monthly export completed: ${result.filename}`,
            filename: result.filename,
            hash: result.hash
          });
        }
      } catch (err) {
        console.warn('Automated scheduled ledger export check encountered an issue:', err);
      }
    };

    runAutoCheck();

    return () => {
      isMounted = false;
    };
  }, [tenantId, tenantName, gstin, refresh]);

  return {
    policy,
    history,
    isExporting,
    lastExportStatus,
    updatePolicy,
    triggerExport,
    refresh
  };
}
