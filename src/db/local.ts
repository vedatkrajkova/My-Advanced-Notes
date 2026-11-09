import Dexie, { type Table } from 'dexie';
import type { Note, NoteTag, Tag, Task, TaskList, TaskTag } from '../domain/types';

export interface MetaRow {
  key: string;
  value: string;
}

export class LocalDb extends Dexie {
  notes!: Table<Note, string>;
  task_lists!: Table<TaskList, string>;
  tasks!: Table<Task, string>;
  tags!: Table<Tag, string>;
  note_tags!: Table<NoteTag, string>;
  task_tags!: Table<TaskTag, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('shenime-detyra');
    const common = 'id, updated_at, dirty';
    this.version(1).stores({
      notes: `${common}, parent_id`,
      task_lists: common,
      tasks: `${common}, list_id, parent_id`,
      tags: common,
      note_tags: `${common}, note_id, tag_id`,
      task_tags: `${common}, task_id, tag_id`,
      meta: 'key',
    });
  }
}

export const db = new LocalDb();
