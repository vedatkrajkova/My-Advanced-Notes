import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { update } from '../../db/repo';
import type { Note } from '../../domain/types';

const SAVE_DELAY_MS = 500;

export function NoteEditor({ note, path, onDelete }: { note: Note; path: Note[]; onDelete(): void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Partial<Note>>({});

  // Ndryshim nga pajisja tjetër: zbatohet vetëm kur s'ka redaktim në pritje.
  useEffect(() => {
    if (Object.keys(pending.current).length) return;
    setTitle(note.title);
    setContent(note.content);
  }, [note.title, note.content]);

  // Ruaj çdo gjë në pritje kur editori mbyllet.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function flush() {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) void update<Note>('notes', note.id, patch);
  }

  function schedule(patch: Partial<Note>) {
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  return (
    <article className="editor">
      <div className="editor__bar">
        <nav aria-label="Rruga" className="editor__crumbs">
          {path.map((p) => p.title.trim() || 'Pa titull').join(' / ')}
        </nav>
        <button type="button" className="btn-ghost" onClick={() => setPreview((v) => !v)}>
          {preview ? 'Redakto' : 'Pamja'}
        </button>
        <button type="button" className="btn-ghost btn-danger" onClick={onDelete}>
          Fshi
        </button>
      </div>
      <input
        aria-label="Titulli"
        className="editor__title"
        placeholder="Pa titull"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          schedule({ title: e.target.value });
        }}
        onBlur={flush}
      />
      {preview ? (
        <div className="markdown">
          <Markdown>{content}</Markdown>
        </div>
      ) : (
        <textarea
          aria-label="Përmbajtja"
          className="editor__body"
          placeholder="Shkruaj në Markdown: # titull, - listë, **bold**"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            schedule({ content: e.target.value });
          }}
          onBlur={flush}
        />
      )}
    </article>
  );
}
