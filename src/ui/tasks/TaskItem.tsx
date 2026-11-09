import { update } from '../../db/repo';
import type { Task } from '../../domain/types';
import { PRIORITY_LABELS, TaskDetails } from './TaskDetails';

interface Props {
  task: Task;
  subtasks: Task[];
  openId: string | null;
  onOpen(id: string | null): void;
  now: Date;
}

const MONTHS = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'korr', 'gush', 'sht', 'tet', 'nën', 'dhj'];

/** "9 nën" — pa varësi nga të dhënat lokale të shfletuesit. */
export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function dueLabel(task: Task, now: Date): { text: string; overdue: boolean } | null {
  if (!task.due_at) return null;
  const d = new Date(task.due_at);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    text: formatShortDate(d),
    overdue: !task.done && d < today,
  };
}

export function TaskItem({ task, subtasks, openId, onOpen, now }: Props) {
  const title = task.title.trim() || 'Pa titull';
  const isSub = Boolean(task.parent_id);
  const due = dueLabel(task, now);
  const open = openId === task.id;

  return (
    <li aria-label={title} className={`task${isSub ? ' task--sub' : ''}${task.done ? ' is-done' : ''}`}>
      <div className="task__row">
        <input
          type="checkbox"
          className={`task__check task__check--${task.priority}`}
          aria-label={title}
          checked={task.done}
          onChange={(e) => void update<Task>('tasks', task.id, { done: e.target.checked })}
        />
        <button type="button" className="task__title" aria-expanded={open} onClick={() => onOpen(open ? null : task.id)}>
          {title}
        </button>
        <span className="task__meta">
          {due && <span className={`task__due${due.overdue ? ' is-overdue' : ''}`}>{due.text}</span>}
          {task.remind_at && (
            <span className="task__bell" title="Ka kujtesë" aria-label="Ka kujtesë">
              🔔
            </span>
          )}
          {task.priority === 'high' && <span className="task__prio">{PRIORITY_LABELS.high}</span>}
        </span>
      </div>
      {open && <TaskDetails task={task} subtaskIds={subtasks.map((s) => s.id)} onClose={() => onOpen(null)} />}
      {subtasks.length > 0 && (
        <ul className="task__subs">
          {subtasks.map((s) => (
            <TaskItem key={s.id} task={s} subtasks={[]} openId={openId} onOpen={onOpen} now={now} />
          ))}
        </ul>
      )}
    </li>
  );
}
