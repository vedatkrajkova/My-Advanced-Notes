import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../../src/db/local';
import { create, setCurrentUser } from '../../../src/db/repo';
import type { Note } from '../../../src/domain/types';
import { NotesPage, handleDrop } from '../../../src/ui/notes/NotesPage';

function renderAt(path = '/notes') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notes/:noteId?" element={<NotesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const base = { content: '', sort_key: 'a0', pinned: false, icon: null };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  setCurrentUser('u');
});

test('new root note appears in the tree', async () => {
  renderAt();
  await userEvent.click(await screen.findByRole('button', { name: 'Shënim i ri' }));
  const tree = screen.getByRole('tree');
  expect(await within(tree).findByText('Pa titull')).toBeInTheDocument();
  expect(await db.notes.count()).toBe(1);
});

test('creating inside a note makes a child and expands the parent', async () => {
  const p = await create<Note>('notes', { ...base, title: 'Puna', parent_id: null });
  renderAt(`/notes/${p.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Shto nën-shënim te Puna' }));
  await waitFor(async () => expect((await db.notes.toArray()).some((n) => n.parent_id === p.id)).toBe(true));
  expect(await within(screen.getByRole('tree')).findByText('Pa titull')).toBeInTheDocument();
});

test('editing the title saves it locally as dirty', async () => {
  const n = await create<Note>('notes', { ...base, title: 'Vjetër', parent_id: null });
  await db.notes.update(n.id, { dirty: 0 });
  renderAt(`/notes/${n.id}`);
  const title = await screen.findByLabelText('Titulli');
  await userEvent.clear(title);
  await userEvent.type(title, 'I ri');
  await waitFor(async () => {
    const saved = await db.notes.get(n.id);
    expect(saved?.title).toBe('I ri');
    expect(saved?.dirty).toBe(1);
  });
});

test('markdown bold is rendered as strong in preview', async () => {
  const n = await create<Note>('notes', { ...base, title: 'M', content: 'një **fjalë**', parent_id: null });
  renderAt(`/notes/${n.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Pamja' }));
  expect((await screen.findByText('fjalë')).tagName).toBe('STRONG');
});

test('breadcrumb shows the parent path', async () => {
  const a = await create<Note>('notes', { ...base, title: 'Puna', parent_id: null });
  const b = await create<Note>('notes', { ...base, title: 'Projekti A', parent_id: a.id });
  const c = await create<Note>('notes', { ...base, title: 'Takimi', parent_id: b.id });
  renderAt(`/notes/${c.id}`);
  expect(await screen.findByLabelText('Rruga')).toHaveTextContent('Puna / Projekti A');
});

test('dropping a note into its own descendant changes nothing', async () => {
  const a = await create<Note>('notes', { ...base, title: 'A', parent_id: null });
  const b = await create<Note>('notes', { ...base, title: 'B', parent_id: a.id });
  await handleDrop(a.id, b.id);
  expect((await db.notes.get(a.id))?.parent_id).toBeNull();
  await handleDrop(b.id, 'root');
  expect((await db.notes.get(b.id))?.parent_id).toBeNull();
});
