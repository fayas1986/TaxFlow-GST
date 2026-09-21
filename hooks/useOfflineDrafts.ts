import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb, LocalDraft } from '../utils/localDb';

const EMPTY_DRAFTS: LocalDraft[] = [];

export function useOfflineDrafts(type: 'INVOICE' | 'DOCUMENT') {
  const drafts = useLiveQuery(() => localDb.drafts.where('type').equals(type).toArray(), [type]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveDraft = useCallback(async (id: string, data: any) => {
    await localDb.drafts.put({
      id,
      type,
      data,
      updatedAt: new Date().toISOString(),
      synced: false,
    });
  }, [type]);

  const deleteDraft = useCallback(async (id: string) => {
    await localDb.drafts.delete(id);
  }, []);

  return { drafts: drafts ?? EMPTY_DRAFTS, isOnline, saveDraft, deleteDraft };
}
