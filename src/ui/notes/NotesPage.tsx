import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/local';
import { create } from '../../db/repo';
import { buildTree, compareSiblings, deleteNoteCascade, moveNote } from '../../domain/notesTree';
import { keyForIndex } from '../../domain/sortKey';
import type { Note } from '../../domain/types';
import { NoteEditor } from './NoteEditor';
import { NotesTree } from './NotesTree';

/** Lëshimi i shënimit `activeId` mbi `overId` (ose 'root'): bëhet fëmija i fundit i tij. */
export async function handleDrop(activeId: string, overId: string): Promise<boolean> {
  if (activeId === overId) return false;
  const parentId = overId === 'root' ? null : overId;
  const siblings = (await db.notes.toArray()).filter((n) => !n.deleted && n.parent_id === parentId && n.id !== activeId);
  try {
    await moveNote(activeId, parentId, siblings.length);
    return true;
  } catch (e) {
    if (e instanceof Error && e.message === 'cycle') return false;
    throw e;
  }
}

/** Prindërit e shënimit, nga rrënja poshtë. */
function ancestorsOf(byId: Map<string, Note>, id: string): Note[] {
  const out: Note[] = [];
  const seen = new Set<string>([id]);
  let parentId = byId.get(id)?.parent_id ?? null;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    out.unshift(parent);
    parentId = parent.parent_id;
  }
  return out;
}

export function NotesPage() {
  const { noteId = null } = useParams();
  const navigate = useNavigate();
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  );

  const live = useMemo(() => (notes ?? []).filter((n) => !n.deleted), [notes]);
  const byId = useMemo(() => new Map(live.map((n) => [n.id, n])), [live]);
  const tree = useMemo(() => buildTree(live), [live]);
  const selected = noteId ? byId.get(noteId) : undefined;
  const path = useMemo(() => (selected ? ancestorsOf(byId, selected.id) : []), [byId, selected]);

  // Hap prindërit e shënimit të zgjedhur.
  useEffect(() => {
    if (!path.length) return;
    setExpanded((prev) => {
      if (path.every((p) => prev.has(p.id))) return prev;
      const next = new Set(prev);
      path.forEach((p) => next.add(p.id));
      return next;
    });
  }, [path]);

  async function addChild(parentId: string | null) {
    const siblings = live.filter((n) => n.parent_id === parentId).sort(compareSiblings).map((n) => n.sort_key);
    const note = await create<Note>('notes', {
      title: '',
      content: '',
      parent_id: parentId,
      sort_key: keyForIndex(siblings, siblings.length),
      pinned: false,
      icon: null,
    });
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
    setDrawerOpen(false);
    navigate(`/notes/${note.id}`);
  }

  async function remove(note: Note) {
    const hasChildren = live.some((n) => n.parent_id === note.id);
    const msg = hasChildren ? 'Fshi këtë shënim dhe të gjitha nën-shënimet e tij?' : 'Fshi këtë shënim?';
    if (!window.confirm(msg)) return;
    await deleteNoteCascade(note.id);
    navigate(note.parent_id ? `/notes/${note.parent_id}` : '/notes');
  }

  function onDragEnd(e: DragEndEvent) {
    const over = e.over;
    if (!over) return;
    void handleDrop(String(e.active.id), String(over.id)).then((moved) => {
      if (moved && over.id !== 'root') setExpanded((prev) => new Set(prev).add(String(over.id)));
    });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!notes) return null;

  return (
    <div className={`notes${drawerOpen ? ' notes--drawer-open' : ''}`}>
      <aside className="notes__side">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <NotesTree
            nodes={tree}
            selectedId={noteId}
            expanded={expanded}
            onToggle={toggle}
            onSelect={(id) => {
              setDrawerOpen(false);
              navigate(`/notes/${id}`);
            }}
            onAddChild={(id) => void addChild(id)}
          />
        </DndContext>
      </aside>
      <button type="button" className="notes__scrim" aria-label="Mbyll listën" onClick={() => setDrawerOpen(false)} />
      <section className="notes__main">
        <button type="button" className="notes__drawer-btn btn-ghost" onClick={() => setDrawerOpen(true)}>
          ☰ Shënimet
        </button>
        {selected ? (
          <NoteEditor key={selected.id} note={selected} path={path} onDelete={() => void remove(selected)} />
        ) : (
          <div className="empty">
            <p>Zgjidh një shënim nga lista ose krijo një të ri.</p>
            <button type="button" className="btn-primary" onClick={() => void addChild(null)}>
              Krijo shënim
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
