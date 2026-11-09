// Logjikë e pastër (pa Deno/npm), që testohet me Vitest.

export interface ReminderRow {
  id: string;
  user_id: string;
  title: string;
  remind_at: string | null;
  done: boolean;
  deleted: boolean;
  reminded_at: string | null;
}

export function selectDue<T extends ReminderRow>(rows: T[], now: Date): T[] {
  return rows.filter(
    (r) => r.remind_at && Date.parse(r.remind_at) <= now.getTime() && !r.done && !r.deleted && !r.reminded_at,
  );
}

/** Abonimi nuk ekziston më te shërbimi push dhe duhet fshirë. */
export function isGone(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}
