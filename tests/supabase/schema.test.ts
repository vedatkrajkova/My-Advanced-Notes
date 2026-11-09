// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

// Imiton atë që Supabase ofron: skemën auth, auth.uid(), rolin authenticated dhe publikimin realtime.
const SUPABASE_STUB = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  create publication supabase_realtime;
`;

let pg: PGlite;

async function as(user: string) {
  await pg.exec(`reset role; set request.jwt.claim.sub = '${user}'; set role authenticated;`);
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  await pg.exec(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'));
});

test('all tables exist with RLS enabled', async () => {
  const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(
    `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`);
  expect(r.rows).toEqual(
    ['note_tags', 'notes', 'push_subscriptions', 'tags', 'task_lists', 'task_tags', 'tasks'].map((relname) => ({ relname, relrowsecurity: true })));
});

test('user B cannot see user A rows', async () => {
  await as(A);
  await pg.query(`insert into notes (id, title, sort_key, updated_at) values (gen_random_uuid(), 'a', 'a0', now())`);
  await as(B);
  const r = await pg.query<{ c: number }>(`select count(*)::int as c from notes`);
  expect(r.rows[0].c).toBe(0);
  await as(A);
  const r2 = await pg.query<{ c: number }>(`select count(*)::int as c from notes`);
  expect(r2.rows[0].c).toBe(1);
});

test('user B cannot insert a row owned by A', async () => {
  await as(B);
  await expect(pg.query(
    `insert into notes (id, user_id, title, sort_key, updated_at) values (gen_random_uuid(), '${A}', 'x', 'a0', now())`,
  )).rejects.toThrow(/row-level security/);
});

test('priority is restricted to low, medium, high', async () => {
  await as(A);
  await expect(pg.query(
    `insert into tasks (id, title, sort_key, priority, updated_at) values (gen_random_uuid(), 't', 'a0', 'urgent', now())`,
  )).rejects.toThrow(/priority/);
});

test('server_updated_at is set by the server on insert and update', async () => {
  await as(A);
  const id = '11111111-1111-1111-1111-111111111111';
  await pg.query(`insert into tags (id, name, color, updated_at, server_updated_at) values ('${id}', 't', '#000', '2000-01-01', '2000-01-01')`);
  const r = await pg.query<{ s: Date }>(`select server_updated_at as s from tags where id = '${id}'`);
  expect(r.rows[0].s.getFullYear()).toBeGreaterThan(2000);
});

test('upsert with an older updated_at does not overwrite a newer row', async () => {
  await as(A);
  const id = '22222222-2222-2222-2222-222222222222';
  const up = (title: string, ts: string) => pg.query(
    `insert into notes (id, title, sort_key, updated_at) values ('${id}', '${title}', 'a0', '${ts}')
     on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at`);
  await up('i ri', '2026-01-05T10:00:00Z');
  await up('i vjetër', '2026-01-05T09:00:00Z');
  const r = await pg.query<{ title: string }>(`select title from notes where id = '${id}'`);
  expect(r.rows[0].title).toBe('i ri');
  await up('më i ri', '2026-01-05T11:00:00Z');
  const r2 = await pg.query<{ title: string }>(`select title from notes where id = '${id}'`);
  expect(r2.rows[0].title).toBe('më i ri');
});

describe('migration 0002 reminded_at', () => {
  beforeAll(async () => {
    await pg.exec('reset role;');
    await pg.exec(readFileSync('supabase/migrations/0002_reminded_at.sql', 'utf8'));
  });

  test('changing remind_at resets reminded_at; other edits keep it', async () => {
    await as(A);
    const id = '33333333-3333-3333-3333-333333333333';
    await pg.query(`insert into tasks (id, title, sort_key, updated_at, remind_at) values ('${id}', 't', 'a0', '2026-01-01', '2026-01-02T10:00Z')`);
    await pg.query(`update tasks set reminded_at = now() where id = '${id}'`);
    await pg.query(`update tasks set title = 'x', updated_at = '2026-01-01T01:00Z' where id = '${id}'`);
    let r = await pg.query<{ reminded_at: Date | null }>(`select reminded_at from tasks where id = '${id}'`);
    expect(r.rows[0].reminded_at).not.toBeNull();
    await pg.query(`update tasks set remind_at = '2026-01-03T10:00Z', updated_at = '2026-01-01T02:00Z' where id = '${id}'`);
    r = await pg.query<{ reminded_at: Date | null }>(`select reminded_at from tasks where id = '${id}'`);
    expect(r.rows[0].reminded_at).toBeNull();
  });
});
