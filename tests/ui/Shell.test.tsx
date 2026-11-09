import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Shell } from '../../src/ui/Shell';
import { SyncIndicator, STATUS_TEXT } from '../../src/ui/SyncIndicator';
import type { SyncStatus } from '../../src/sync/engine';

test.each([
  ['synced', 'sinkronizuar'],
  ['syncing', 'duke sinkronizuar…'],
  ['offline', 'offline'],
  ['error', 'gabim sinkronizimi — provohet përsëri'],
] as [SyncStatus, string][])('SyncIndicator shows text for %s', (status, text) => {
  render(<SyncIndicator status={status} />);
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(STATUS_TEXT[status]).toBe(text);
});

test('Shell links to notes and tasks and renders the page', () => {
  render(
    <MemoryRouter initialEntries={['/tasks']}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/tasks" element={<p>faqja e detyrave</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  const notes = screen.getAllByRole('link', { name: /Shënime/ });
  const tasks = screen.getAllByRole('link', { name: /Detyra/ });
  expect(notes[0]).toHaveAttribute('href', '/notes');
  expect(tasks[0]).toHaveAttribute('href', '/tasks');
  expect(tasks[0]).toHaveAttribute('aria-current', 'page');
  expect(screen.getByText('faqja e detyrave')).toBeInTheDocument();
});

test('SyncIndicator says local-only when sync is not configured', () => {
  render(<SyncIndicator localOnly />);
  expect(screen.getByText('vetëm në këtë pajisje')).toBeInTheDocument();
});
