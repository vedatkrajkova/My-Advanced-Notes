import { db } from '../db/local';
import { create } from '../db/repo';
import { compareSiblings } from './notesTree';
import { keyForIndex } from './sortKey';
import type { Task } from './types';

export type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later' | 'done';

export const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'tomorrow', 'soon', 'later', 'done'];

export const GROUP_LABELS: Record<GroupKey, string> = {
  overdue: 'Vonuar',
  today: 'Sot',
  tomorrow: 'Nesër',
  soon: 'Së shpejti',
  later: 'Më vonë',
  done: 'Të kryera',
};

/** Numri i ditës lokale (pa orë), për krahasim sipas kalendarit të pajisjes. */
function dayNumber(d: Date): number {
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
}

export function groupOf(task: Task, now: Date): GroupKey {
  if (task.done) return 'done';
  if (!task.due_at) return 'later';
  const diff = dayNumber(new Date(task.due_at)) - dayNumber(now);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 8) return 'soon';
  return 'later';
}

function compareInGroup(a: Task, b: Task): number {
  if (a.due_at !== b.due_at) {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at < b.due_at ? -1 : 1;
  }
  return compareSiblings(a, b);
}

export function groupTasks(tasks: Task[], now: Date): { key: GroupKey; tasks: Task[] }[] {
  const buckets = new Map<GroupKey, Task[]>();
  for (const task of tasks) {
    if (task.deleted || task.parent_id) continue;
    const key = groupOf(task, now);
    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }
  return GROUP_ORDER.filter((k) => buckets.has(k)).map((key) => ({
    key,
    tasks: buckets.get(key)!.sort(compareInGroup),
  }));
}

export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((x) => !x.deleted && x.parent_id === parentId).sort(compareSiblings);
}

export async function addSubtask(parent: Task, title: string): Promise<Task> {
  if (parent.parent_id) throw new Error('depth');
  const siblings = subtasksOf(await db.tasks.toArray(), parent.id).map((x) => x.sort_key);
  return create<Task>('tasks', {
    list_id: parent.list_id,
    parent_id: parent.id,
    title,
    description: '',
    done: false,
    due_at: null,
    remind_at: null,
    priority: 'medium',
    sort_key: keyForIndex(siblings, siblings.length),
  });
}
