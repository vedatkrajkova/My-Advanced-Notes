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
