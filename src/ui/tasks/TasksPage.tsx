import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type FormEvent } from 'react';
import { db } from '../../db/local';
import { create } from '../../db/repo';
import { compareSiblings } from '../../domain/notesTree';
import { keyForIndex } from '../../domain/sortKey';
import { GROUP_LABELS, groupTasks, subtasksOf } from '../../domain/taskGroups';
import type { Task, TaskList } from '../../domain/types';
import { filterByTag, TagFilter } from '../tags/TagFilter';
import { dateInputToIso, isoToDateInput } from './TaskDetails';
import { TaskItem } from './TaskItem';
import { ALL_LISTS, TaskLists } from './TaskLists';

const LIST_KEY = 'tasks_selected_list';

function readSelected(): string {
  try {
    return localStorage.getItem(LIST_KEY) ?? ALL_LISTS;
  } catch {
    return ALL_LISTS;
  }
}

type DueChoice = 'none' | 'today' | 'tomorrow';

function dueFromChoice(choice: DueChoice, now: Date): string | null {
  if (choice === 'none') return null;
  const d = new Date(now);
  if (choice === 'tomorrow') d.setDate(d.getDate() + 1);
  return dateInputToIso(isoToDateInput(d.toISOString()));
}

export function TasksPage() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const lists = useLiveQuery(() => db.task_lists.toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const taskTags = useLiveQuery(() => db.task_tags.toArray(), []);
  const [tagId, setTagId] = useState<string | null>(null);
  const [selected, setSelectedState] = useState(readSelected);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState<DueChoice>('none');
  const now = new Date();

  const liveLists = useMemo(() => (lists ?? []).filter((l) => !l.deleted).sort(compareSiblings), [lists]);
  const listExists = selected === ALL_LISTS || liveLists.some((l) => l.id === selected);
  const current = listExists ? selected : ALL_LISTS;

  const all = useMemo(() => (tasks ?? []).filter((t) => !t.deleted), [tasks]);
  const inList = current === ALL_LISTS ? all : all.filter((t) => t.list_id === current);
  const visible = filterByTag(inList, taskTags ?? [], tagId, 'task_id');
  const groups = groupTasks(visible, now);

  function select(id: string) {
    setSelectedState(id);
    try {
      localStorage.setItem(LIST_KEY, id);
    } catch {
      /* pa ruajtje lokale */
    }
  }

  async function createList(name: string) {
    const list = await create<TaskList>('task_lists', {
      name,
      sort_key: keyForIndex(liveLists.map((l) => l.sort_key), liveLists.length),
    });
    select(list.id);
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const topLevel = all.filter((t) => !t.parent_id).map((t) => t.sort_key);
    await create<Task>('tasks', {
      list_id: current === ALL_LISTS ? null : current,
      parent_id: null,
      title,
      description: '',
      done: false,
      due_at: dueFromChoice(newDue, new Date()),
      remind_at: null,
      priority: 'medium',
      sort_key: keyForIndex(topLevel, topLevel.length),
    });
    setNewTitle('');
  }

  if (!tasks || !lists) return null;

  return (
    <div className="tasks">
      <TaskLists lists={liveLists} selected={current} onSelect={select} onCreate={(n) => void createList(n)} />
      <TagFilter tags={tags ?? []} selectedTagId={tagId} onChange={setTagId} />
      <div className="tasks__body">
        {groups.length === 0 && <p className="empty">Asnjë detyrë këtu. Shto të parën më poshtë.</p>}
        {groups.map((g) => (
          <section key={g.key} role="region" aria-label={GROUP_LABELS[g.key]} className={`group group--${g.key}`}>
            <h2 className="group__title">{GROUP_LABELS[g.key]}</h2>
            <ul className="group__list">
              {g.tasks.map((t) => (
                <TaskItem key={t.id} task={t} subtasks={subtasksOf(all, t.id)} openId={openId} onOpen={setOpenId} now={now} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="tasks__add">
        {adding ? (
          <form className="quick" onSubmit={(e) => void addTask(e)}>
            <input
              autoFocus
              aria-label="Detyra e re"
              placeholder="Çfarë duhet bërë?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            />
            <select aria-label="Afati" value={newDue} onChange={(e) => setNewDue(e.target.value as DueChoice)}>
              <option value="none">Pa afat</option>
              <option value="today">Sot</option>
              <option value="tomorrow">Nesër</option>
            </select>
            <button type="submit" className="btn-primary">
              Shto
            </button>
          </form>
        ) : (
          <button type="button" className="btn-primary tasks__new" onClick={() => setAdding(true)}>
            + Detyrë e re
          </button>
        )}
      </div>
    </div>
  );
}
