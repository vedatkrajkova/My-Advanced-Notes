import { db } from '../../src/db/local';
import { create, update, softDelete, list, setCurrentUser, adoptLocalRows } from '../../src/db/repo';
import type { Note } from '../../src/domain/types';

const noteData = { title: 'A', content: '', parent_id: null, sort_key: 'a0', pinned: false, icon: null };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  setCurrentUser('user-1');
});

test('create sets id, user_id, updated_at and dirty=1', async () => {
  const n = await create<Note>('notes', noteData);
  expect(n.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(n.user_id).toBe('user-1');
  expect(n.updated_at).toBeTruthy();
  expect(n.deleted).toBe(false);
  const stored = await db.notes.get(n.id);
  expect(stored?.dirty).toBe(1);
});

test('update changes updated_at and sets dirty=1', async () => {
  const n = await create<Note>('notes', noteData);
  await db.notes.update(n.id, { dirty: 0, updated_at: '2000-01-01T00:00:00.000Z' });
  await update<Note>('notes', n.id, { title: 'B' });
  const stored = await db.notes.get(n.id);
  expect(stored?.title).toBe('B');
  expect(stored?.dirty).toBe(1);
  expect(stored!.updated_at > '2000-01-01T00:00:00.000Z').toBe(true);
});

test('softDelete hides row from list but keeps it with deleted=true', async () => {
  const n = await create<Note>('notes', noteData);
  await softDelete('notes', n.id);
  expect(await list<Note>('notes')).toHaveLength(0);
  const stored = await db.notes.get(n.id);
  expect(stored?.deleted).toBe(true);
  expect(stored?.dirty).toBe(1);
});

test('adoptLocalRows gives local-mode rows to the signed-in user and marks them dirty', async () => {
  setCurrentUser('local');
  const n = await create<Note>('notes', noteData);
  await db.notes.update(n.id, { dirty: 0 });
  setCurrentUser('real-user');
  const other = await create<Note>('notes', noteData);
  await adoptLocalRows('real-user');
  expect((await db.notes.get(n.id))?.user_id).toBe('real-user');
  expect((await db.notes.get(n.id))?.dirty).toBe(1);
  expect((await db.notes.get(other.id))?.user_id).toBe('real-user');
});

test('update after seeing a version stamped in the future (skewed clock) still wins', async () => {
  const n = await create<Note>('notes', noteData);
  const future = new Date(Date.now() + 90_000).toISOString();
  await db.notes.update(n.id, { updated_at: future, dirty: 0 });
  await update<Note>('notes', n.id, { title: 'redaktim i ri' });
  expect((await db.notes.get(n.id))!.updated_at > future).toBe(true);
  await db.notes.update(n.id, { updated_at: new Date(Date.now() + 90_000).toISOString() });
  const before = (await db.notes.get(n.id))!.updated_at;
  await softDelete('notes', n.id);
  expect((await db.notes.get(n.id))!.updated_at > before).toBe(true);
});
