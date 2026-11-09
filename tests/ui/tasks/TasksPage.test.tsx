import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../../src/db/local';
import { create, setCurrentUser } from '../../../src/db/repo';
import type { Task, TaskList } from '../../../src/domain/types';
import { TasksPage } from '../../../src/ui/tasks/TasksPage';

const base = { parent_id: null, description: '', done: false, due_at: null, remind_at: null, priority: 'medium' as const, sort_key: 'a0' };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  localStorage.clear();
  setCurrentUser('u');
});

function group(name: string) {
  return screen.getByRole('region', { name });
}

test('quick add with "Sot" places the task in the Sot group', async () => {
  render(<TasksPage />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Detyrë e re' }));
  await userEvent.type(screen.getByLabelText('Detyra e re'), 'Dërgo raportin');
  await userEvent.selectOptions(screen.getByLabelText('Afati'), 'today');
  await userEvent.click(screen.getByRole('button', { name: 'Shto' }));
  await waitFor(() => expect(within(group('Sot')).getByText('Dërgo raportin')).toBeInTheDocument());
});

test('quick add without a date places the task in Më vonë', async () => {
  render(<TasksPage />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Detyrë e re' }));
  await userEvent.type(screen.getByLabelText('Detyra e re'), 'Lexo librin{Enter}');
  await waitFor(() => expect(within(group('Më vonë')).getByText('Lexo librin')).toBeInTheDocument());
});

test('clicking the circle marks the task done and moves it to Të kryera', async () => {
  const t = await create<Task>('tasks', { ...base, list_id: null, title: 'Blej bukë' });
  render(<TasksPage />);
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Blej bukë' }));
  await waitFor(async () => expect((await db.tasks.get(t.id))?.done).toBe(true));
  await waitFor(() => expect(within(group('Të kryera')).getByText('Blej bukë')).toBeInTheDocument());
});

test('subtask is shown nested under its parent, and a subtask offers no further subtasks', async () => {
  const p = await create<Task>('tasks', { ...base, list_id: null, title: 'Raporti' });
  render(<TasksPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Raporti' }));
  await userEvent.type(screen.getByLabelText('Nëndetyrë e re'), 'Shto grafikët{Enter}');
  const parentItem = await screen.findByRole('listitem', { name: 'Raporti' });
  await waitFor(() => expect(within(parentItem).getByRole('checkbox', { name: 'Shto grafikët' })).toBeInTheDocument());
  const sub = (await db.tasks.toArray()).find((x) => x.parent_id === p.id)!;
  expect(sub.title).toBe('Shto grafikët');
  await userEvent.click(within(parentItem).getByRole('button', { name: 'Shto grafikët' }));
  expect(screen.queryAllByLabelText('Nëndetyrë e re')).toHaveLength(0);
});

test('creating a list adds a tab', async () => {
  render(<TasksPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Listë e re' }));
  await userEvent.type(screen.getByLabelText('Emri i listës'), 'Puna{Enter}');
  expect(await screen.findByRole('tab', { name: 'Puna' })).toBeInTheDocument();
  expect((await db.task_lists.toArray()).map((l) => l.name)).toEqual(['Puna']);
});

test('selecting a list shows only its tasks and new tasks go into it', async () => {
  const work = await create<TaskList>('task_lists', { name: 'Puna', sort_key: 'a0' });
  await create<TaskList>('task_lists', { name: 'Shtëpia', sort_key: 'a1' });
  await create<Task>('tasks', { ...base, list_id: work.id, title: 'Takim' });
  await create<Task>('tasks', { ...base, list_id: null, title: 'Gatim' });
  render(<TasksPage />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Puna' }));
  expect(await screen.findByText('Takim')).toBeInTheDocument();
  expect(screen.queryByText('Gatim')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '+ Detyrë e re' }));
  await userEvent.type(screen.getByLabelText('Detyra e re'), 'Email{Enter}');
  await waitFor(async () => expect((await db.tasks.toArray()).find((x) => x.title === 'Email')?.list_id).toBe(work.id));
  await userEvent.click(screen.getByRole('tab', { name: 'Të gjitha' }));
  expect(await screen.findByText('Gatim')).toBeInTheDocument();
});

test('due dates use Albanian month names', async () => {
  const { formatShortDate } = await import('../../../src/ui/tasks/TaskItem');
  expect(formatShortDate(new Date(2026, 10, 9))).toBe('9 nën');
  expect(formatShortDate(new Date(2026, 0, 1))).toBe('1 jan');
});
