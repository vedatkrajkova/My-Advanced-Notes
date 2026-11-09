import { db } from '../../src/db/local';
import { create, setCurrentUser } from '../../src/db/repo';
import type { Task } from '../../src/domain/types';
import { groupTasks, subtasksOf, addSubtask, GROUP_LABELS } from '../../src/domain/taskGroups';

const now = new Date(2026, 10, 9, 15, 0); // 9 nëntor 2026, 15:00 ora lokale
const day = (d: number, h = 10) => new Date(2026, 10, d, h, 0).toISOString();

function t(id: string, due_at: string | null, extra: Partial<Task> = {}): Task {
  return { id, due_at, title: id, description: '', done: false, list_id: null, parent_id: null,
    remind_at: null, priority: 'medium', sort_key: 'a0', user_id: 'u', created_at: '', updated_at: '',
    deleted: false, ...extra };
}

const keysOf = (tasks: Task[]) =>
  Object.fromEntries(groupTasks(tasks, now).map((g) => [g.key, g.tasks.map((x) => x.id)]));

test('tasks are distributed by local day', () => {
  const g = keysOf([
    t('past', day(7)), t('today-early', day(9, 8)), t('tomorrow', day(10)),
    t('soon', day(15)), t('far', day(30)), t('none', null),
  ]);
  expect(g).toEqual({
    overdue: ['past'], today: ['today-early'], tomorrow: ['tomorrow'], soon: ['soon'], later: ['far', 'none'],
  });
});

test('soon ends 7 days after tomorrow', () => {
  const g = keysOf([t('d17', day(17)), t('d18', day(18))]);
  expect(g.soon).toEqual(['d17']);
  expect(g.later).toEqual(['d18']);
});

test('done tasks go to done group, never disappear', () => {
  const g = keysOf([t('old-done', day(1), { done: true }), t('open', null)]);
  expect(g.done).toEqual(['old-done']);
  expect(g.later).toEqual(['open']);
});

test('subtasks and deleted tasks are not top-level; empty groups omitted', () => {
  const groups = groupTasks([t('p', null), t('s', null, { parent_id: 'p' }), t('x', null, { deleted: true })], now);
  expect(groups.map((g) => g.key)).toEqual(['later']);
  expect(groups[0].tasks.map((x) => x.id)).toEqual(['p']);
});

test('labels are Albanian', () => {
  expect(GROUP_LABELS).toEqual({ overdue: 'Vonuar', today: 'Sot', tomorrow: 'Nesër', soon: 'Së shpejti', later: 'Më vonë', done: 'Të kryera' });
});

test('subtasksOf returns live children sorted', () => {
  const list = [t('p', null), t('b', null, { parent_id: 'p', sort_key: 'a2' }), t('a', null, { parent_id: 'p', sort_key: 'a1' }),
    t('z', null, { parent_id: 'p', deleted: true })];
  expect(subtasksOf(list, 'p').map((x) => x.id)).toEqual(['a', 'b']);
});

describe('addSubtask', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((x) => x.clear()));
    setCurrentUser('u');
  });
  const base = { list_id: 'L', parent_id: null, description: '', done: false, due_at: null, remind_at: null,
    priority: 'medium' as const, sort_key: 'a0' };

  test('creates a subtask in the same list', async () => {
    const parent = await create<Task>('tasks', { ...base, title: 'P' });
    const sub = await addSubtask(parent, 'S');
    expect(sub.parent_id).toBe(parent.id);
    expect(sub.list_id).toBe('L');
  });

  test('refuses a sub-subtask', async () => {
    const parent = await create<Task>('tasks', { ...base, title: 'P' });
    const sub = await addSubtask(parent, 'S');
    await expect(addSubtask(sub, 'SS')).rejects.toThrow('depth');
  });
});
