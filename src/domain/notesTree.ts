import { db } from '../db/local';
import { softDeleteMany, update } from '../db/repo';
import { keyForIndex } from './sortKey';
import type { Note } from './types';

export type TreeNode = Note & { children: TreeNode[] };

export function compareSiblings(a: { sort_key: string; id: string }, b: { sort_key: string; id: string }): number {
  if (a.sort_key !== b.sort_key) return a.sort_key < b.sort_key ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Ndërton pemën nga shënimet jo të fshira. Një shënim, prindi i të cilit mungon
 * (p.sh. ende pa sinkronizuar ose i fshirë në pajisjen tjetër), shfaqet në rrënjë
 * që të mos humbasë.
 */
export function buildTree(notes: Note[]): TreeNode[] {
  const live = notes.filter((x) => !x.deleted);
  const byId = new Map<string, TreeNode>(live.map((x) => [x.id, { ...x, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortAll = (list: TreeNode[]) => {
    list.sort(compareSiblings);
    list.forEach((c) => sortAll(c.children));
  };
  sortAll(roots);
  return roots;
}

export function descendantIds(notes: Note[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const x of notes) {
    if (!x.parent_id) continue;
    const arr = childrenOf.get(x.parent_id) ?? [];
    arr.push(x.id);
    childrenOf.set(x.parent_id, arr);
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(id) ?? [])];
  const seen = new Set<string>([id]);
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return out;
}

export function canMove(notes: Note[], id: string, newParentId: string | null): boolean {
  if (newParentId === null) return true;
  if (newParentId === id) return false;
  return !descendantIds(notes, id).includes(newParentId);
}

export async function moveNote(id: string, newParentId: string | null, index: number): Promise<void> {
  const all = await db.notes.toArray();
  if (!canMove(all, id, newParentId)) throw new Error('cycle');
  const siblings = all
    .filter((x) => !x.deleted && x.parent_id === newParentId && x.id !== id)
    .sort(compareSiblings)
    .map((x) => x.sort_key);
  await update<Note>('notes', id, { parent_id: newParentId, sort_key: keyForIndex(siblings, index) });
}

export async function deleteNoteCascade(id: string): Promise<void> {
  const all = await db.notes.toArray();
  await softDeleteMany('notes', [id, ...descendantIds(all, id)]);
}
