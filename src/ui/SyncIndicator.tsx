import { useEffect, useState } from 'react';
import { getStatus, onStatus, type SyncStatus } from '../sync/engine';

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

export function SyncIndicator({ status }: { status?: SyncStatus }) {
  const live = useSyncStatus();
  const s = status ?? live;
  return (
    <span className={`sync sync--${s}`} role="status">
      <span aria-hidden="true">{ICON[s]}</span> <span>{STATUS_TEXT[s]}</span>
    </span>
  );
}
