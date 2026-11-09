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

/**
 * Shënoje kujtesën si të dërguar vetëm kur arriti te të paktën një pajisje, ose kur
 * përdoruesi s'ka asnjë pajisje. Gabimet e përkohshme provohen përsëri pas një minute.
 */
export function shouldMarkReminded(r: { subsError: boolean; subscriptions: number; delivered: number; transientFailures: number }): boolean {
  if (r.subsError) return false;
  if (r.delivered > 0) return true;
  return r.transientFailures === 0;
}

/** Abonimi nuk ekziston më te shërbimi push dhe duhet fshirë. */
export function isGone(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}
