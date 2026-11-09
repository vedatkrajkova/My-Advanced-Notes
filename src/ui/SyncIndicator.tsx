import { useEffect, useState } from 'react';
import { getStatus, onStatus, type SyncStatus } from '../sync/engine';
import { supabase } from '../sync/supabase';

export const STATUS_TEXT: Record<SyncStatus, string> = {
  synced: 'sinkronizuar',
  syncing: 'duke sinkronizuar…',
  offline: 'offline',
  error: 'gabim sinkronizimi — provohet përsëri',
};

const ICON: Record<SyncStatus, string> = { synced: '✓', syncing: '⟳', offline: '⚠', error: '⚠' };

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(getStatus());
  useEffect(() => onStatus(setS), []);
  return s;
}

export function SyncIndicator({ status, localOnly = !supabase }: { status?: SyncStatus; localOnly?: boolean }) {
  const live = useSyncStatus();
  const s = status ?? live;
  if (localOnly && !status) {
    return (
      <span className="sync sync--local" role="status" title="Sinkronizimi nuk është konfiguruar">
        <span aria-hidden="true">●</span> <span>vetëm në këtë pajisje</span>
      </span>
    );
  }
  return (
    <span className={`sync sync--${s}`} role="status">
      <span aria-hidden="true">{ICON[s]}</span> <span>{STATUS_TEXT[s]}</span>
    </span>
  );
}
