import { db } from '../../src/db/local';
import { create, update, softDelete, list, setCurrentUser } from '../../src/db/repo';
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
