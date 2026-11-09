import { db } from '../../src/db/local';
import { create, setCurrentUser } from '../../src/db/repo';
import type { Note } from '../../src/domain/types';
import { buildTree, canMove, descendantIds, moveNote, deleteNoteCascade } from '../../src/domain/notesTree';

function n(id: string, parent_id: string | null, sort_key = 'a0'): Note {
  return { id, parent_id, sort_key, title: id, content: '', pinned: false, icon: null,
    user_id: 'u', created_at: '', updated_at: '', deleted: false };
}

const chain = [n('1', null), n('2', '1'), n('3', '2'), n('4', '3'), n('5', '4')];

test('buildTree builds 5 levels deep', () => {
  const tree = buildTree(chain);
  expect(tree).toHaveLength(1);
  expect(tree[0].children[0].children[0].children[0].children[0].id).toBe('5');
});

test('buildTree sorts children by sort_key then id', () => {
  const tree = buildTree([n('p', null), n('b', 'p', 'a1'), n('a', 'p', 'a2'), n('c', 'p', 'a1')]);
  expect(tree[0].children.map((c) => c.id)).toEqual(['b', 'c', 'a']);
});

test('buildTree ignores deleted notes and promotes nothing', () => {
  const tree = buildTree([n('1', null), { ...n('2', '1'), deleted: true }]);
  expect(tree[0].children).toHaveLength(0);
});

test('descendantIds returns all descendants', () => {
  expect(descendantIds(chain, '2').sort()).toEqual(['3', '4', '5']);
});

test('canMove rejects self and descendants, allows root', () => {
  expect(canMove(chain, '2', '2')).toBe(false);
  expect(canMove(chain, '2', '5')).toBe(false);
  expect(canMove(chain, '2', null)).toBe(true);
  expect(canMove(chain, '5', '1')).toBe(true);
});

describe('with local db', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    setCurrentUser('u');
  });

  async function mk(parent_id: string | null) {
    return create<Note>('notes', { title: 'x', content: '', parent_id, sort_key: 'a0', pinned: false, icon: null });
  }

  test('moveNote into own descendant throws cycle and changes nothing', async () => {
    const a = await mk(null);
    const b = await mk(a.id);
    await expect(moveNote(a.id, b.id, 0)).rejects.toThrow('cycle');
    expect((await db.notes.get(a.id))?.parent_id).toBeNull();
  });

  test('moveNote sets new parent and a sort_key before existing first child', async () => {
    const a = await mk(null);
    const b = await mk(null);
    const c = await mk(a.id);
    await moveNote(b.id, a.id, 0);
    const moved = await db.notes.get(b.id);
    expect(moved?.parent_id).toBe(a.id);
    expect(moved!.sort_key < c.sort_key).toBe(true);
  });

  test('deleteNoteCascade marks note and all descendants deleted', async () => {
    const a = await mk(null);
    const b = await mk(a.id);
    const c = await mk(b.id);
    const other = await mk(null);
    await deleteNoteCascade(a.id);
    for (const id of [a.id, b.id, c.id]) expect((await db.notes.get(id))?.deleted).toBe(true);
    expect((await db.notes.get(other.id))?.deleted).toBe(false);
  });
});
