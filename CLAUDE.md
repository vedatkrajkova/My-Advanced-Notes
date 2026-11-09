# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user, offline-first PWA for notes (unlimited-depth tree, Markdown) and tasks (lists, one level of subtasks, due dates, reminders, priority, tags). It targets PC (installed via Chrome/Edge) and Android (installed via Chrome). It is built with React 18, TypeScript, Vite, Dexie (IndexedDB), Supabase (Postgres, Auth, Realtime, Edge Functions) and Netlify. All UI text and code comments are in **Albanian**; keep new UI copy in Albanian.

The design spec is `docs/superpowers/specs/2026-11-09-notes-tasks-pwa-design.md` and the implementation plan is `docs/superpowers/plans/2026-11-09-notes-tasks-pwa.md`. Deployment and Supabase setup steps for the user are in `docs/setup.md`.

## Commands

```bash
npm run dev                       # Vite dev server (http://localhost:5173)
npm test                          # Vitest, all tests (jsdom)
npx vitest run tests/sync         # one folder
npx vitest run -t "cycle"         # tests whose name matches
npx tsc -b                        # typecheck (build also runs it)
npm run build                     # tsc + vite build + service worker (dist/)
npm run preview                   # serve dist/ to test PWA/offline behaviour
python scripts/make_icons.py public/icons   # regenerate PNG icons (no deps)
```

There is no linter configured. `.claude/launch.json` defines `app` (dev, port 5173) and `preview` (port 4173) servers.

## Environment

`.env.local` (git-ignored) holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (a Supabase publishable key) and optionally `VITE_VAPID_PUBLIC_KEY`. See `.env.example`.

**When the Supabase vars are missing, the app runs in local-only mode:**
- `src/sync/supabase.ts` exports `supabase = null`.
- `AuthGate` signs in as user id `'local'` without showing the login form.
- Sync and realtime do not start, and `SyncIndicator` shows "vetëm në këtë pajisje".

On a real sign-in, `adoptLocalRows` reassigns `'local'` rows to that user.

## Architecture

### Data flow

The UI only reads from and writes to Dexie. It never calls the network directly. Screens use `useLiveQuery`, so rows arriving from sync re-render automatically.

```
UI ⇄ src/db/repo.ts (Dexie) ⇄ src/sync/engine.ts ⇄ Supabase ⇄ other device
```

### Row model (`src/domain/types.ts`)

- Every synced table has the same base columns: `id` (a client UUID), `user_id`, `created_at`, `updated_at`, `deleted` (soft delete; rows are never hard-deleted, so deletes sync), and the local-only `dirty` flag (0/1).
- Tables: `notes`, `task_lists`, `tasks`, `tags`, `note_tags`, `task_tags`.
- `push_subscriptions` exists only on the server. `meta` is local only and holds the sync cursors.
- **Always write through `repo.ts`** (`create`, `update`, `softDelete`, `softDeleteMany`), never `db.table.update` directly. `repo` does three things a direct write skips:
  - sets `dirty = 1`;
  - stamps `updated_at` monotonically: `max(now, previous + 1ms)`, so an edit always beats the version it was made from, even with clock skew between devices;
  - notifies `onLocalWrite`, which triggers a debounced sync.

### Sync (`src/sync/engine.ts`)

- **Conflicts are last-write-wins per row, comparing client `updated_at`.** Compare with `Date.parse`, never as strings: Postgres returns `+00:00` and the client writes `Z`.
- **Push:** upserts the dirty rows of each table. It clears `dirty` only if the row's `updated_at` has not changed since it was read.
- **Server-owned fields** are stripped before upsert: `dirty`, `server_updated_at`, `reminded_at`.
- **Pull cursor:** uses `server_updated_at`, which the server sets by trigger, not `updated_at`. Each pull re-reads a `PULL_OVERLAP_MS` window because the server stamps at write time, not commit time. Re-applying a row is idempotent.
- **Realtime** (`realtime.ts`) only triggers `syncNow()`. It never applies payloads, so LWW lives in one place.
- **Remote boundary:** `RemoteApi`, `AuthApi`, `RealtimeClient` and `PushDeps` are injectable. Tests use in-memory fakes, for example `FakeRemote` in `tests/sync/engine.test.ts`.

### Server (`supabase/`)

**`migrations/0001_schema.sql`** creates the tables plus:
- RLS on every table (`user_id = auth.uid()`);
- a `keep_newer_row` BEFORE UPDATE trigger that silently skips an update with an older `updated_at` (server-side LWW, so a plain upsert is safe);
- the `server_updated_at` trigger.

Trigger names matter: Postgres fires same-timing triggers alphabetically, and `*_keep_newer` must run before the others.

**`migrations/0002_reminded_at.sql`** adds the server-owned `reminded_at` column. A trigger resets it whenever `remind_at` changes.

**Migrations are tested in a real Postgres via PGlite** (`tests/supabase/schema.test.ts`), with a stubbed `auth.uid()`, `authenticated` role and `supabase_realtime` publication. When you change SQL, extend that test.

**`functions/send-reminders/`** is a Deno Edge Function, called every minute by pg_cron (see `docs/setup.md`).
- Pure logic lives in `logic.ts` and is tested by Vitest.
- `index.ts` is Deno-only: it uses `npm:` imports and is not typechecked by `tsc`.
- It marks `reminded_at` only after a delivery, or when the user has no subscriptions, so transient failures retry.

### Domain rules (`src/domain/`)

- **Notes** (`notesTree.ts`): any note can have children (a "folder" is just a note with children).
  - `canMove`/`moveNote` refuse cycles.
  - `deleteNoteCascade` soft-deletes descendants.
  - `buildTree` never hides a live note: if its parent is missing, deleted or part of a cross-device cycle, it shows at root. Tag filtering relies on this.
- **Tasks** (`taskGroups.ts`): subtasks are exactly one level deep (`addSubtask` throws `depth`).
  - `groupTasks` buckets by the local calendar day into `overdue`, `today`, `tomorrow`, `soon` (≤ 8 days), `later` (including no due date) and `done`.
  - A subtask whose parent is not in the given list is shown top-level.
- **Ordering** uses fractional `sort_key`s (`sortKey.ts`, via `fractional-indexing`). Ties are broken by `id` (`compareSiblings`).

### PWA and push

- `vite-plugin-pwa` runs in `injectManifest` mode with the custom service worker `src/push/sw.ts`. It handles workbox precaching, SPA navigation fallback, `push` and `notificationclick`.
- **The service worker must not import anything that pulls in supabase-js.** That is why `notificationFromPayload` lives in `src/push/notification.ts`.
- Push permission is requested when the user sets a reminder (`TaskDetails`).

### UI

- Routes: `/notes/:noteId?` and `/tasks`, inside `Shell`, which has a top tab bar on wide screens and a bottom nav under 768px.
- Styles are plain CSS in `src/ui/theme.css`, with light/dark CSS variables.
- Editors autosave: `NoteEditor` debounces by 500ms. Both `NoteEditor` and `TaskDetails` also flush on blur and on page hide via `useFlushOnHide`.

## Testing notes

- `src/test/setup.ts` loads `fake-indexeddb` and installs an in-memory `localStorage`, because Node ≥ 25's global `localStorage` shadows jsdom's.
- DB tests clear all Dexie tables in `beforeEach` and call `setCurrentUser`.
- Tests needing Node APIs (PGlite, `fs`) start with `// @vitest-environment node`.
