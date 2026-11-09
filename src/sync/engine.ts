import { db } from '../db/local';
import { onLocalWrite } from '../db/repo';
import { TABLES, type BaseRow, type TableName } from '../domain/types';
import { supabase } from './supabase';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export type RemoteRow = BaseRow & { server_updated_at: string };

export interface RemoteApi {
  upsert(table: TableName, rows: BaseRow[]): Promise<void>;
  /** Rreshtat me server_updated_at > since, të renditur në rritje, deri në `limit`. */
  fetchSince(table: TableName, since: string | null, limit: number): Promise<RemoteRow[]>;
}

export const PAGE_SIZE = 1000;

export const supabaseRemote: RemoteApi = {
  async upsert(table, rows) {
    if (!supabase) throw new Error('Supabase nuk është konfiguruar');
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },
  async fetchSince(table, since, limit) {
    if (!supabase) throw new Error('Supabase nuk është konfiguruar');
    let q = supabase.from(table).select('*').order('server_updated_at', { ascending: true }).limit(limit);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data as RemoteRow[];
  },
};

// ---- statusi ----
const listeners = new Set<(s: SyncStatus) => void>();
let status: SyncStatus = 'synced';

function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((cb) => cb(s));
}

export function getStatus(): SyncStatus {
  return status;
}

export function onStatus(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---- dërgimi ----
function toRemote(row: BaseRow): BaseRow {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.dirty;
  delete copy.server_updated_at;
  delete copy.reminded_at; // vendoset vetëm nga serveri (send-reminders)
  return copy as unknown as BaseRow;
}

export async function pushDirty(remote: RemoteApi): Promise<void> {
  for (const name of TABLES) {
    const table = db.table<BaseRow, string>(name);
    const dirty = await table.where('dirty').equals(1).toArray();
    if (!dirty.length) continue;
    await remote.upsert(name, dirty.map(toRemote));
    // Pastro "dirty" vetëm për rreshtat që nuk janë ndryshuar gjatë dërgimit.
    await db.transaction('rw', table, async () => {
      for (const sent of dirty) {
        const cur = await table.get(sent.id);
        if (cur && cur.updated_at === sent.updated_at) await table.update(sent.id, { dirty: 0 });
      }
    });
  }
}

// ---- marrja ----
const cursorKey = (t: TableName) => `cursor:${t}`;

export async function pullChanges(remote: RemoteApi): Promise<void> {
  for (const name of TABLES) {
    const table = db.table<BaseRow, string>(name);
    let since = (await db.meta.get(cursorKey(name)))?.value ?? null;
    for (;;) {
      const rows = await remote.fetchSince(name, since, PAGE_SIZE);
      if (!rows.length) break;
      await db.transaction('rw', table, db.meta, async () => {
        for (const r of rows) {
          const local = await table.get(r.id);
          if (!local || Date.parse(r.updated_at) > Date.parse(local.updated_at)) {
            await table.put({ ...r, updated_at: new Date(r.updated_at).toISOString(), dirty: 0 } as BaseRow);
          }
        }
        since = rows[rows.length - 1].server_updated_at;
        await db.meta.put({ key: cursorKey(name), value: since });
      });
      if (rows.length < PAGE_SIZE) break;
    }
  }
}

// ---- sinkronizimi i plotë ----
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}

let running: Promise<void> | null = null;
let again = false;

export async function syncNow(remote: RemoteApi = supabaseRemote): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      setStatus('syncing');
      try {
        await pushDirty(remote);
        await pullChanges(remote);
        setStatus('synced');
      } catch (e) {
        setStatus(isNetworkError(e) ? 'offline' : 'error');
        if (!isNetworkError(e)) console.error('Sinkronizimi dështoi', e);
        again = false;
      }
    } while (again);
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

export function startAutoSync(remote: RemoteApi = supabaseRemote): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(remote), 800);
  };
  const onOnline = () => void syncNow(remote);
  const onOffline = () => setStatus('offline');
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const offWrite = onLocalWrite(soon);
  const interval = setInterval(() => void syncNow(remote), 30_000);
  void syncNow(remote);
  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    offWrite();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
