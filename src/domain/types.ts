export interface BaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  /** Vetëm lokalisht: 1 = pa dërguar në server. */
  dirty?: 0 | 1;
}

export type Priority = 'low' | 'medium' | 'high';

export interface Note extends BaseRow {
  title: string;
  content: string;
  parent_id: string | null;
  sort_key: string;
  pinned: boolean;
  icon: string | null;
}

export interface TaskList extends BaseRow {
  name: string;
  sort_key: string;
}

export interface Task extends BaseRow {
  list_id: string | null;
  parent_id: string | null;
  title: string;
  description: string;
  done: boolean;
  due_at: string | null;
  remind_at: string | null;
  priority: Priority;
  sort_key: string;
}

export interface Tag extends BaseRow {
  name: string;
  color: string;
}

export interface NoteTag extends BaseRow {
  note_id: string;
  tag_id: string;
}

export interface TaskTag extends BaseRow {
  task_id: string;
  tag_id: string;
}

export interface RowTypes {
  notes: Note;
  task_lists: TaskList;
  tasks: Task;
  tags: Tag;
  note_tags: NoteTag;
  task_tags: TaskTag;
}

export type TableName = keyof RowTypes;

export const TABLES: TableName[] = ['notes', 'task_lists', 'tasks', 'tags', 'note_tags', 'task_tags'];
