import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '../../../src/db/local';
import { create, setCurrentUser } from '../../../src/db/repo';
import type { Task } from '../../../src/domain/types';

const subscribe = vi.fn(async () => 'denied' as const);
vi.mock('../../../src/push/subscribe', () => ({ subscribeToPush: () => subscribe() }));

const { TaskDetails } = await import('../../../src/ui/tasks/TaskDetails');

const base = { list_id: null, parent_id: null, description: '', done: false, due_at: null, remind_at: null, priority: 'medium' as const, sort_key: 'a0' };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  setCurrentUser('u');
  subscribe.mockClear();
});

test('setting a reminder saves it, asks for push permission and explains a refusal', async () => {
  const t = await create<Task>('tasks', { ...base, title: 'Telefono' });
  render(<TaskDetails task={t} subtaskIds={[]} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('Kujtesa'), { target: { value: '2026-11-10T09:30' } });
  await waitFor(async () => expect((await db.tasks.get(t.id))?.remind_at).toBe(new Date('2026-11-10T09:30').toISOString()));
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/Njoftimet janë të bllokuara/)).toBeInTheDocument();
});

test('clearing a reminder does not ask for permission', async () => {
  const t = await create<Task>('tasks', { ...base, title: 'X', remind_at: new Date().toISOString() });
  render(<TaskDetails task={t} subtaskIds={[]} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('Kujtesa'), { target: { value: '' } });
  await waitFor(async () => expect((await db.tasks.get(t.id))?.remind_at).toBeNull());
  expect(subscribe).not.toHaveBeenCalled();
});
