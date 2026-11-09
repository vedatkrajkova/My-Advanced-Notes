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
  await db.table(name).update(id, { ...patch, updated_at: now(), dirty: 1 });
  notifyWrite();
}

export async function softDelete(name: TableName, id: string): Promise<void> {
  await db.table(name).update(id, { deleted: true, updated_at: now(), dirty: 1 });
  notifyWrite();
}

export async function softDeleteMany(name: TableName, ids: string[]): Promise<void> {
  const ts = now();
  await db.transaction('rw', db.table(name), async () => {
    for (const id of ids) await db.table(name).update(id, { deleted: true, updated_at: ts, dirty: 1 });
  });
  notifyWrite();
}

export async function list<T extends BaseRow>(name: TableName): Promise<T[]> {
  const rows = (await table(name).toArray()) as unknown as T[];
  return rows.filter((r) => !r.deleted);
}
