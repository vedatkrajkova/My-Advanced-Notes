import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type KeyboardEvent } from 'react';
import { db } from '../../db/local';
import { create, softDeleteMany } from '../../db/repo';
import type { BaseRow, NoteTag, Tag, TaskTag } from '../../domain/types';

const COLORS = ['#2f6fed', '#2e9d63', '#c98a12', '#d64545', '#8a4fd6', '#1a9aa8'];

type Kind = 'note' | 'task';

/** Etiketat e një shënimi ose detyre: kliko për ta vendosur/hequr, shkruaj për të krijuar. */
export function TagPicker({ kind, itemId }: { kind: Kind; itemId: string }) {
  const linkTable = kind === 'note' ? 'note_tags' : 'task_tags';
  const key = kind === 'note' ? 'note_id' : 'task_id';
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const links = useLiveQuery(
    () => db.table<NoteTag | TaskTag, string>(linkTable).where(key).equals(itemId).toArray(),
    [linkTable, key, itemId],
  );
  const [name, setName] = useState('');

  if (!tags || !links) return null;
  const live = tags.filter((t) => !t.deleted).sort((a, b) => a.name.localeCompare(b.name, 'sq'));
  const activeLinks = links.filter((l) => !l.deleted);
  const linkedIds = new Set(activeLinks.map((l) => l.tag_id));

  async function link(tagId: string) {
    await create(linkTable, { [key]: itemId, tag_id: tagId } as Omit<NoteTag, keyof BaseRow>);
  }

  async function toggle(tag: Tag) {
    const existing = activeLinks.filter((l) => l.tag_id === tag.id).map((l) => l.id);
    if (existing.length) await softDeleteMany(linkTable, existing);
    else await link(tag.id);
  }

  async function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    setName('');
    const existing = live.find((t) => t.name.toLocaleLowerCase('sq') === value.toLocaleLowerCase('sq'));
    const tag = existing ?? (await create<Tag>('tags', { name: value, color: COLORS[live.length % COLORS.length] }));
    if (!linkedIds.has(tag.id)) await link(tag.id);
  }

  return (
    <div className="tagpicker">
      {live.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tag"
          aria-pressed={linkedIds.has(t.id)}
          style={{ '--tag': t.color } as React.CSSProperties}
          onClick={() => void toggle(t)}
        >
          {t.name}
        </button>
      ))}
      <input
        aria-label="Etiketë e re"
        className="tagpicker__input"
        placeholder="+ etiketë"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => void onKey(e)}
      />
    </div>
  );
}
