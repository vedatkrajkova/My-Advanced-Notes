import type { Tag } from '../../domain/types';

export type LinkKey = 'note_id' | 'task_id';

export function filterByTag<T extends { id: string }>(
  items: T[],
  links: ({ tag_id: string; deleted: boolean } & Partial<Record<LinkKey, string>>)[],
  tagId: string | null,
  key: LinkKey,
): T[] {
  if (!tagId) return items;
  const ids = new Set(links.filter((l) => !l.deleted && l.tag_id === tagId).map((l) => l[key]));
  return items.filter((i) => ids.has(i.id));
}

interface Props {
  tags: Tag[];
  selectedTagId: string | null;
  onChange(id: string | null): void;
}

export function TagFilter({ tags, selectedTagId, onChange }: Props) {
  const live = tags.filter((t) => !t.deleted).sort((a, b) => a.name.localeCompare(b.name, 'sq'));
  if (!live.length) return null;
  return (
    <div className="tagfilter" aria-label="Filtro sipas etiketës" role="group">
      {live.map((t) => {
        const on = selectedTagId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className="tag"
            aria-pressed={on}
            style={{ '--tag': t.color } as React.CSSProperties}
            onClick={() => onChange(on ? null : t.id)}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
