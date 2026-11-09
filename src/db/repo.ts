import { db } from './local';
import type { BaseRow, RowTypes, TableName } from '../domain/types';

let currentUserId = '';

export function setCurrentUser(id: string): void {
  currentUserId = id;
}

export function getCurrentUser(): string {
  return currentUserId;
}

type Listener = () => void;
const writeListeners = new Set<Listener>();

/** Thirret pas çdo shkrimi lokal (p.sh. që sinkronizimi të nisë). */
export function onLocalWrite(cb: Listener): () => void {
  writeListeners.add(cb);
  return () => writeListeners.delete(cb);
}

function notifyWrite(): void {
  writeListeners.forEach((cb) => cb());
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Koha e ndryshimit: gjithmonë pas versionit që po ndryshohet, edhe nëse ora e kësaj
 * pajisjeje mbetet pas asaj të pajisjes tjetër. Përndryshe redaktimi më i ri humbet (LWW).
 */
function stampAfter(previous: string | undefined): string {
  const t = Date.now();
  const prev = previous ? Date.parse(previous) : NaN;
  return new Date(Number.isNaN(prev) || t > prev ? t : prev + 1).toISOString();
}

async function stampRow(name: TableName, id: string, patch: Record<string, unknown>): Promise<void> {
  const t = db.table(name);
  await db.transaction('rw', t, async () => {
    const cur = (await t.get(id)) as { updated_at?: string } | undefined;
    if (!cur) return;
    await t.update(id, { ...patch, updated_at: stampAfter(cur.updated_at), dirty: 1 });
  });
}

function table<T extends TableName>(name: T) {
  return db.table<RowTypes[T], string>(name);
}

export async function create<T extends BaseRow>(
  name: TableName,
  data: Omit<T, keyof BaseRow>,
): Promise<T> {
  const ts = now();
  const row = {
    ...data,
    id: crypto.randomUUID(),
    user_id: currentUserId,
    created_at: ts,
    updated_at: ts,
    deleted: false,
    dirty: 1,
  } as unknown as T;
  await db.table(name).add(row);
  notifyWrite();
  return row;
}

export async function update<T extends BaseRow>(
  name: TableName,
  id: string,
  patch: Partial<Omit<T, keyof BaseRow>>,
): Promise<void> {
  await stampRow(name, id, patch as Record<string, unknown>);
  notifyWrite();
}

export async function softDelete(name: TableName, id: string): Promise<void> {
  await stampRow(name, id, { deleted: true });
  notifyWrite();
}

export async function softDeleteMany(name: TableName, ids: string[]): Promise<void> {
  for (const id of ids) await stampRow(name, id, { deleted: true });
  notifyWrite();
}

export async function list<T extends BaseRow>(name: TableName): Promise<T[]> {
  const rows = (await table(name).toArray()) as unknown as T[];
  return rows.filter((r) => !r.deleted);
}

export const LOCAL_USER_ID = 'local';

/** Rreshtat e krijuar pa llogari (modaliteti lokal) i kalojnë përdoruesit që sapo hyri. */
export async function adoptLocalRows(userId: string): Promise<void> {
  if (userId === LOCAL_USER_ID) return;
  for (const t of db.tables) {
    if (t.name === 'meta') continue;
    await t.toCollection().modify((row: { user_id?: string; dirty?: number }) => {
      if (row.user_id === LOCAL_USER_ID) {
        row.user_id = userId;
        row.dirty = 1;
      }
    });
  }
}
