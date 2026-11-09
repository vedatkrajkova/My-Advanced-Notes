import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../../src/db/local';
import { create, setCurrentUser } from '../../../src/db/repo';
import type { Tag } from '../../../src/domain/types';
import { filterByTag, TagFilter } from '../../../src/ui/tags/TagFilter';
import { TagPicker } from '../../../src/ui/tags/TagPicker';

const items = [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }];
const link = (note_id: string, tag_id: string, deleted = false) => ({ note_id, tag_id, deleted });

test('filterByTag with null returns all items', () => {
  expect(filterByTag(items, [link('n1', 't1')], null, 'note_id')).toEqual(items);
});

test('filterByTag returns only items linked to the tag', () => {
  const links = [link('n1', 't1'), link('n2', 't2'), link('n3', 't1')];
  expect(filterByTag(items, links, 't1', 'note_id').map((i) => i.id)).toEqual(['n1', 'n3']);
});

test('filterByTag ignores deleted links', () => {
  expect(filterByTag(items, [link('n1', 't1', true)], 't1', 'note_id')).toEqual([]);
});

const tags = [
  { id: 't1', name: 'Urgjente', color: '#d64545', deleted: false },
  { id: 't2', name: 'E fshirë', color: '#888', deleted: true },
] as Tag[];

test('TagFilter shows live tags and reports the selection', async () => {
  const onChange = vi.fn();
  render(<TagFilter tags={tags} selectedTagId={null} onChange={onChange} />);
  expect(screen.queryByRole('button', { name: 'E fshirë' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Urgjente' }));
  expect(onChange).toHaveBeenCalledWith('t1');
});

test('TagFilter clicking the selected tag clears the filter', async () => {
  const onChange = vi.fn();
  render(<TagFilter tags={tags} selectedTagId="t1" onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Urgjente' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Urgjente' }));
  expect(onChange).toHaveBeenCalledWith(null);
});

describe('TagPicker', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    setCurrentUser('u');
  });

  test('creating a new tag links it to the note', async () => {
    render(<TagPicker kind="note" itemId="n1" />);
    await userEvent.type(await screen.findByLabelText('Etiketë e re'), 'Ide{Enter}');
    await waitFor(async () => {
      const [tag] = await db.tags.toArray();
      expect(tag.name).toBe('Ide');
      const links = await db.note_tags.toArray();
      expect(links).toMatchObject([{ note_id: 'n1', tag_id: tag.id, deleted: false }]);
    });
  });

  test('toggling an existing tag adds then removes the link', async () => {
    const tag = await create<Tag>('tags', { name: 'Puna', color: '#2f6fed' });
    render(<TagPicker kind="task" itemId="x1" />);
    const chip = await screen.findByRole('button', { name: 'Puna' });
    await userEvent.click(chip);
    await waitFor(async () => expect((await db.task_tags.toArray()).filter((l) => !l.deleted)).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Puna' })).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(screen.getByRole('button', { name: 'Puna' }));
    await waitFor(async () => expect((await db.task_tags.toArray()).filter((l) => !l.deleted)).toHaveLength(0));
    expect(tag.id).toBeTruthy();
  });
});
