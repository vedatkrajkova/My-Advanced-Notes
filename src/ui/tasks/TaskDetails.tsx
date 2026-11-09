import { useState, type KeyboardEvent } from 'react';
import { softDeleteMany, update } from '../../db/repo';
import { addSubtask } from '../../domain/taskGroups';
import type { Priority, Task } from '../../domain/types';

export const PRIORITY_LABELS: Record<Priority, string> = { low: 'I ulët', medium: 'Mesatar', high: 'I lartë' };

/** "YYYY-MM-DD" lokale ⇄ ISO (mesnata lokale). */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${isoToDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDetails({ task, subtaskIds, onClose }: { task: Task; subtaskIds: string[]; onClose(): void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [subTitle, setSubTitle] = useState('');

  const save = (patch: Partial<Task>) => void update<Task>('tasks', task.id, patch);

  async function onSubKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = subTitle.trim();
    if (!value) return;
    setSubTitle('');
    await addSubtask(task, value);
  }

  async function remove() {
    const msg = subtaskIds.length ? 'Fshi këtë detyrë dhe nëndetyrat e saj?' : 'Fshi këtë detyrë?';
    if (!window.confirm(msg)) return;
    await softDeleteMany('tasks', [task.id, ...subtaskIds]);
    onClose();
  }

  return (
    <div className="details">
      <input
        aria-label="Titulli i detyrës"
        className="details__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== task.title && save({ title })}
      />
      <textarea
        aria-label="Përshkrimi"
        className="details__desc"
        placeholder="Shënime (Markdown)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== task.description && save({ description })}
      />
      <div className="details__grid">
        <label>
          <span>Data e afatit</span>
          <input type="date" value={isoToDateInput(task.due_at)} onChange={(e) => save({ due_at: dateInputToIso(e.target.value) })} />
        </label>
        <label>
          <span>Kujtesa</span>
          <input
            type="datetime-local"
            value={isoToDateTimeInput(task.remind_at)}
            onChange={(e) => save({ remind_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </label>
        <label>
          <span>Prioriteti</span>
          <select value={task.priority} onChange={(e) => save({ priority: e.target.value as Priority })}>
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!task.parent_id && (
        <input
          aria-label="Nëndetyrë e re"
          className="details__sub"
          placeholder="+ Nëndetyrë e re"
          value={subTitle}
          onChange={(e) => setSubTitle(e.target.value)}
          onKeyDown={(e) => void onSubKey(e)}
        />
      )}
      <div className="details__actions">
        <button type="button" className="btn-ghost btn-danger" onClick={() => void remove()}>
          Fshi detyrën
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Mbyll
        </button>
      </div>
    </div>
  );
}
