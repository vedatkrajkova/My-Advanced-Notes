import { db } from '../../src/db/local';
import { create, update, setCurrentUser } from '../../src/db/repo';
import type { BaseRow, Note, TableName } from '../../src/domain/types';
import { pushDirty, pullChanges, syncNow, onStatus, type RemoteApi, type RemoteRow, type SyncStatus } from '../../src/sync/engine';

/** Server në memorie: zbaton "fiton updated_at më i vonë" dhe vendos server_updated_at. */
class FakeRemote implements RemoteApi {
  rows = new Map<string, RemoteRow>();
  clock = 0;
  failNext: Error | null = null;
  upserted: BaseRow[] = [];
  async upsert(_t: TableName, rows: BaseRow[]) {
    if (this.failNext) { const e = this.failNext; this.failNext = null; throw e; }
    for (const r of rows) {
      this.upserted.push(r);
      const old = this.rows.get(r.id);
      if (old && Date.parse(old.updated_at) > Date.parse(r.updated_at)) continue;
      this.rows.set(r.id, { ...r, server_updated_at: new Date(Date.UTC(2030, 0, 1, 0, 0, ++this.clock)).toISOString() });
    }
  }
  async fetchSince(_t: TableName, since: string | null) {
    if (this.failNext) { const e = this.failNext; this.failNext = null; throw e; }
    return [...this.rows.values()]
      .filter((r) => !since || r.server_updated_at > since)
      .sort((a, b) => (a.server_updated_at < b.server_updated_at ? -1 : 1));
  }
  /** Rresht i shkruar nga "pajisja tjetër". */
  putFromOtherDevice(row: Note) {
    this.rows.set(row.id, { ...row, server_updated_at: new Date(Date.UTC(2030, 0, 1, 0, 0, ++this.clock)).toISOString() });
  }
}

const noteData = { title: 'A', content: '', parent_id: null, sort_key: 'a0', pinned: false, icon: null };

let remote: FakeRemote;
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  setCurrentUser('u');
  remote = new FakeRemote();
});

test('push sends only dirty rows and clears dirty after success', async () => {
  const a = await create<Note>('notes', noteData);
  const b = await create<Note>('notes', noteData);
  await db.notes.update(b.id, { dirty: 0 });
  await pushDirty(remote);
  expect(remote.upserted.map((r) => r.id)).toEqual([a.id]);
  expect('dirty' in remote.upserted[0]).toBe(false);
  expect((await db.notes.get(a.id))?.dirty).toBe(0);
});

test('push that throws leaves dirty=1', async () => {
  const a = await create<Note>('notes', noteData);
  remote.failNext = new TypeError('Failed to fetch');
  await expect(pushDirty(remote)).rejects.toThrow();
  expect((await db.notes.get(a.id))?.dirty).toBe(1);
});

test('edit made during push stays dirty', async () => {
  const a = await create<Note>('notes', noteData);
  const realUpsert = remote.upsert.bind(remote);
  remote.upsert = async (t, rows) => {
    await realUpsert(t, rows);
    await new Promise((r) => setTimeout(r, 2));
    await update<Note>('notes', a.id, { title: 'gjatë dërgimit' });
  };
  await pushDirty(remote);
  expect((await db.notes.get(a.id))?.dirty).toBe(1);
});

test('newer remote row replaces older local row', async () => {
  const a = await create<Note>('notes', noteData);
  await db.notes.update(a.id, { dirty: 0, updated_at: '2026-01-01T00:00:00.000Z' });
  remote.putFromOtherDevice({ ...(await db.notes.get(a.id))!, title: 'nga telefoni', updated_at: '2026-01-02T00:00:00.000+00:00' });
  await pullChanges(remote);
  const local = await db.notes.get(a.id);
  expect(local?.title).toBe('nga telefoni');
  expect(local?.dirty).toBe(0);
});

test('older remote row does not touch newer local row', async () => {
  const a = await create<Note>('notes', noteData);
  await db.notes.update(a.id, { title: 'lokal', updated_at: '2026-01-03T00:00:00.000Z' });
  remote.putFromOtherDevice({ ...(await db.notes.get(a.id))!, title: 'i vjetër', updated_at: '2026-01-02T00:00:00.000Z' });
  await pullChanges(remote);
  const local = await db.notes.get(a.id);
  expect(local?.title).toBe('lokal');
  expect(local?.dirty).toBe(1);
});

test('two offline edits of the same row: later updated_at wins on both sides, one row', async () => {
  const a = await create<Note>('notes', noteData);
  await db.notes.update(a.id, { title: 'PC', updated_at: '2026-01-05T10:00:00.000Z' });
  remote.putFromOtherDevice({ ...(await db.notes.get(a.id))!, title: 'telefon', updated_at: '2026-01-05T09:00:00.000Z' });
  await syncNow(remote);
  expect((await db.notes.get(a.id))?.title).toBe('PC');
  expect((remote.rows.get(a.id) as unknown as Note)?.title).toBe('PC');
  expect(await db.notes.count()).toBe(1);
  expect(remote.rows.size).toBe(1);
});

test('row edited offline long ago and pushed later still reaches the other device', async () => {
  // Pajisja jonë ka marrë tashmë gjithçka deri tani.
  remote.putFromOtherDevice({ ...({ id: 'x', user_id: 'u', created_at: '', updated_at: '2026-01-10T00:00:00.000Z', deleted: false } as BaseRow), ...noteData } as Note);
  await pullChanges(remote);
  // Pajisja tjetër dërgon tani një ndryshim të bërë offline më herët.
  remote.putFromOtherDevice({ id: 'y', user_id: 'u', created_at: '', updated_at: '2026-01-01T00:00:00.000Z', deleted: false, ...noteData, title: 'offline' });
  await pullChanges(remote);
  expect((await db.notes.get('y'))?.title).toBe('offline');
});

test('row deleted on the other device arrives as deleted=true', async () => {
  const a = await create<Note>('notes', noteData);
  await syncNow(remote);
  remote.putFromOtherDevice({ ...(await db.notes.get(a.id))!, deleted: true, updated_at: new Date(Date.now() + 1000).toISOString() });
  await pullChanges(remote);
  expect((await db.notes.get(a.id))?.deleted).toBe(true);
});

test('status goes syncing -> synced, and offline on network error', async () => {
  const seen: SyncStatus[] = [];
  const off = onStatus((s) => seen.push(s));
  await syncNow(remote);
  remote.failNext = new TypeError('Failed to fetch');
  await create<Note>('notes', noteData);
  await syncNow(remote);
  off();
  expect(seen).toEqual(['syncing', 'synced', 'syncing', 'offline']);
});

test('non-network failure sets status error', async () => {
  const seen: SyncStatus[] = [];
  const off = onStatus((s) => seen.push(s));
  await create<Note>('notes', noteData);
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  remote.failNext = new Error('permission denied');
  await syncNow(remote);
  off();
  expect(seen.at(-1)).toBe('error');
  expect(err).toHaveBeenCalled();
  err.mockRestore();
});

test('push never sends reminded_at (server owns it)', async () => {
  const a = await create<Note>('notes', noteData);
  await db.notes.update(a.id, { reminded_at: '2026-01-01T00:00:00Z' } as Partial<Note>);
  await pushDirty(remote);
  expect('reminded_at' in remote.upserted[0]).toBe(false);
});
