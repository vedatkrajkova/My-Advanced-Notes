import { useState, type KeyboardEvent } from 'react';
import { softDeleteMany, update } from '../../db/repo';
import { addSubtask } from '../../domain/taskGroups';
import type { Priority, Task } from '../../domain/types';
import { subscribeToPush } from '../../push/subscribe';
import { TagPicker } from '../tags/TagPicker';
import { useFlushOnHide } from '../useFlushOnHide';

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
  const [pushNote, setPushNote] = useState('');

  const save = (patch: Partial<Task>) => void update<Task>('tasks', task.id, patch);

  // Titulli dhe përshkrimi ruhen kur del nga fusha, ose kur faqja fshihet/mbyllet.
  useFlushOnHide(() => {
    const patch: Partial<Task> = {};
    if (title !== task.title) patch.title = title;
    if (description !== task.description) patch.description = description;
    if (Object.keys(patch).length) save(patch);
  });

  async function setReminder(value: string) {
    const remind_at = value ? new Date(value).toISOString() : null;
    save({ remind_at });
    if (!remind_at) return;
    try {
      const result = await subscribeToPush();
      setPushNote(
        result === 'denied'
          ? 'Njoftimet janë të bllokuara në këtë shfletues. Lejoji te cilësimet e faqes që kujtesa të vijë.'
          : result === 'unsupported'
            ? 'Ky shfletues nuk mbështet njoftimet. Instalo aplikacionin në Chrome ose Edge.'
            : '',
      );
    } catch {
      setPushNote('Njoftimet nuk u aktivizuan tani. Provo përsëri kur të kesh internet.');
    }
  }

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
      <TagPicker kind="task" itemId={task.id} />
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
            onChange={(e) => void setReminder(e.target.value)}
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
      {pushNote && <p className="details__note">{pushNote}</p>}
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
