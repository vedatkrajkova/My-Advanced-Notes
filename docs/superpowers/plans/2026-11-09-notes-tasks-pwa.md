# Aplikacioni i shënimeve dhe detyrave (PWA) — plani i implementimit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ndërto një PWA personale për shënime (pemë pa kufi) dhe detyra, me sinkronizim offline-first mes PC dhe Android dhe kujtesa me Web Push.

**Architecture:** Ndërfaqja lexon dhe shkruan vetëm në Dexie (IndexedDB). Një modul sinkronizimi dërgon rreshtat "pa dërguar" te Supabase dhe merr ndryshimet e reja (pull + Realtime); konflikti zgjidhet me `updated_at` më të vonë. Një Edge Function e planifikuar në Supabase dërgon njoftimet push.

**Tech Stack:** React 18, TypeScript, Vite, vite-plugin-pwa, Dexie, Supabase (Postgres, Auth, Realtime, Edge Functions), `fractional-indexing`, `react-markdown`, `@dnd-kit/core`, Vitest, `fake-indexeddb`, Testing Library, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-09-notes-tasks-pwa-design.md`

## Global Constraints

- Ndërfaqja në shqip; tema e çelët dhe e errët sipas pajisjes (`prefers-color-scheme`).
- Ndërfaqja lexon/shkruan vetëm në Dexie, kurrë drejtpërdrejt në rrjet.
- Çdo rresht ka `id` (UUID nga klienti), `user_id`, `created_at`, `updated_at`, `deleted` (fshirje e butë).
- Shënimet: `parent_id` pa kufi thellësie; ndalohet vendosja e shënimit brenda pasardhësve të vet.
- Detyrat: `parent_id` vetëm një nivel nëndetyrash; `priority` ∈ `low | medium | high`.
- Konflikt: fiton `updated_at` më i vonë, për rresht.
- RLS në çdo tabelë Supabase: `user_id = auth.uid()`.
- Jashtë fushës: iPhone, bashkëngjitje skedarësh, Drive/OneDrive/Mega/Box, Tauri, bashkëpunim.
- Rrënja e projektit: `D:\Claude Code\My-Advanced-Notes` (repo me `origin` në GitHub, aktualisht me një commit specifikimi).

## Review Focus

- Shënim i zhvendosur brenda fëmijës së vet (cikël) → refuzohet, pema nuk ndryshon (Task 4).
- Fshirja e një shënimi me nën-shënime → nën-shënimet fshihen bashkë me të, jo të humbasin pa prind (Task 4).
- Dy ndryshime të njëjtit rresht offline → mbetet ai me `updated_at` më të vonë, pa dyfishim (Task 8).
- Detyra pa afat dhe detyra e kaluar (vonuar) → grupi "Më vonë" / "Vonuar", asnjëherë nuk zhduken nga lista (Task 5).
- Sinkronizim që dështon në mes (rrjeti bie) → rreshtat mbeten "pa dërguar" dhe provohen përsëri, pa humbje (Task 8).

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html, netlify.toml
src/
  main.tsx, App.tsx                    # hyrja, routing, guard i hyrjes
  domain/types.ts                      # tipet e përbashkëta (Note, Task, ...)
  domain/sortKey.ts                    # sort_key fraksional
  domain/notesTree.ts                  # pema, cikli, pasardhësit
  domain/taskGroups.ts                 # grupimi sipas datës, nëndetyrat
  db/local.ts                          # skema Dexie
  db/repo.ts                           # CRUD lokal (create/update/softDelete + dirty)
  sync/supabase.ts                     # klienti Supabase
  sync/engine.ts                       # push, pull, LWW, status
  sync/realtime.ts                     # abonimi Realtime
  auth/AuthGate.tsx                    # magic link
  ui/Shell.tsx, ui/SyncIndicator.tsx, ui/theme.css
  ui/notes/NotesTree.tsx, NoteEditor.tsx, NotesPage.tsx
  ui/tasks/TaskLists.tsx, TaskItem.tsx, TasksPage.tsx
  ui/tags/TagFilter.tsx
  push/subscribe.ts, push/sw.ts        # abonimi + service worker për push
supabase/
  migrations/0001_schema.sql           # tabelat + RLS
  functions/send-reminders/index.ts    # Edge Function (cron)
tests/                                 # pasqyron src/
```

---

### Task 1: Skeleti i projektit

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `.gitignore`
- Test: `tests/App.test.tsx`

**Interfaces:**
- Produces: `App` (React component, default export nga `src/App.tsx`); skriptet `npm run dev | build | test`.

- [ ] **Step 1: Krijo projektin Vite (React + TS) në rrënjë dhe instalo varësitë:** `react`, `react-dom`, `react-router-dom`, `dexie`, `@supabase/supabase-js`, `fractional-indexing`, `react-markdown`, `@dnd-kit/core`, `vite-plugin-pwa`; dev: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `fake-indexeddb`.
- [ ] **Step 2: Shkruaj testin që dështon** — `tests/App.test.tsx::renders app title` bën render `<App />` dhe pohon që teksti `Shënime dhe detyra` është në dokument.
- [ ] **Step 3: Ekzekuto** `npx vitest run tests/App.test.tsx` — pritet FAIL.
- [ ] **Step 4: Implemento `App` në `src/App.tsx`** që shfaq titullin; konfiguro Vitest (`jsdom`, `src/test/setup.ts` importon `fake-indexeddb/auto` dhe `jest-dom`).
- [ ] **Step 5: Ekzekuto** `npx vitest run` — pritet PASS; `npm run build` — pritet pa gabime.
- [ ] **Step 6: Commit** `feat: scaffold vite react pwa project`.

---

### Task 2: Tipet dhe databaza lokale

**Files:**
- Create: `src/domain/types.ts`, `src/db/local.ts`, `src/db/repo.ts`
- Test: `tests/db/repo.test.ts`

**Interfaces:**
- Produces (`types.ts`): `BaseRow { id: string; user_id: string; created_at: string; updated_at: string; deleted: boolean; dirty?: 0 | 1 }`; `Note`, `TaskList`, `Task`, `Tag`, `NoteTag`, `TaskTag` sipas modelit të specifikimit (§3); `Priority = 'low' | 'medium' | 'high'`.
- Produces (`local.ts`): `db` (instancë Dexie) me tabelat `notes, task_lists, tasks, tags, note_tags, task_tags`, indeks mbi `updated_at` dhe `dirty`.
- Produces (`repo.ts`): `create<T extends BaseRow>(table: TableName, data: Omit<T, keyof BaseRow>): Promise<T>`; `update<T>(table, id, patch: Partial<T>): Promise<void>`; `softDelete(table, id): Promise<void>`; `list<T>(table): Promise<T[]>` (vetëm `deleted === false`). Çdo shkrim vendos `updated_at = now`, `dirty = 1`. `user_id` merret nga `setCurrentUser(id: string)`.

- [ ] **Step 1: Teste që dështojnë** në `tests/db/repo.test.ts`: `create vendos id, updated_at dhe dirty=1`; `update ndryshon updated_at dhe dirty=1`; `softDelete e fsheh nga list por rreshti mbetet me deleted=true`.
- [ ] **Step 2: Ekzekuto** `npx vitest run tests/db/repo.test.ts` — FAIL.
- [ ] **Step 3: Implemento `types.ts`, `local.ts`, `repo.ts`;** `id` me `crypto.randomUUID()`.
- [ ] **Step 4: Ekzekuto** testet — PASS.
- [ ] **Step 5: Commit** `feat: local dexie schema and repo`.

---

### Task 3: sort_key fraksional

**Files:**
- Create: `src/domain/sortKey.ts`
- Test: `tests/domain/sortKey.test.ts`

**Interfaces:**
- Produces: `keyBetween(before: string | null, after: string | null): string` (mbështetet te `fractional-indexing`); `keyForIndex(siblingKeys: string[], index: number): string`.

- [ ] **Step 1: Teste që dështojnë:** `keyBetween(null,null)` kthen string jo bosh; `keyBetween(a,b)` ka `a < b` leksikografikisht ndërmjet; dy thirrje të pavarura mes të njëjtëve çelësa nuk prishin renditjen e të tjerëve; `keyForIndex(keys, 0)` është para `keys[0]`, `keyForIndex(keys, keys.length)` pas të fundit.
- [ ] **Step 2: Ekzekuto** — FAIL.
- [ ] **Step 3: Implemento** të dy funksionet si mbështjellës të hollë mbi `generateKeyBetween`.
- [ ] **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: fractional sort keys`.

---

### Task 4: Pema e shënimeve

**Files:**
- Create: `src/domain/notesTree.ts`
- Test: `tests/domain/notesTree.test.ts`

**Interfaces:**
- Consumes: `Note` (Task 2), `keyForIndex` (Task 3), `repo.update/softDelete` (Task 2).
- Produces: `buildTree(notes: Note[]): TreeNode[]` ku `TreeNode = Note & { children: TreeNode[] }`, fëmijët të renditur sipas `sort_key`; `descendantIds(notes: Note[], id: string): string[]`; `canMove(notes: Note[], id: string, newParentId: string | null): boolean`; `moveNote(id: string, newParentId: string | null, index: number): Promise<void>` (hedh `Error('cycle')` nëse `!canMove`); `deleteNoteCascade(id: string): Promise<void>`.

- [ ] **Step 1: Teste që dështojnë:** `buildTree` ndërton 5 nivele thellësi dhe i rendit fëmijët; `canMove` kthen `false` kur `newParentId` është vetë shënimi ose pasardhës i tij, `true` për rrënjën; `moveNote` në cikël hedh `cycle` dhe nuk ndryshon asgjë; `deleteNoteCascade` shënon `deleted=true` te shënimi dhe të gjithë pasardhësit (Review Focus 1–2).
- [ ] **Step 2: Ekzekuto** — FAIL.
- [ ] **Step 3: Implemento funksionet;** `descendantIds` me kalim iterativ (pa rekursion të thellë).
- [ ] **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: unlimited-depth notes tree`.

---

### Task 5: Logjika e detyrave

**Files:**
- Create: `src/domain/taskGroups.ts`
- Test: `tests/domain/taskGroups.test.ts`

**Interfaces:**
- Consumes: `Task` (Task 2).
- Produces: `type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later'`; `groupTasks(tasks: Task[], now: Date): { key: GroupKey; tasks: Task[] }[]` (vetëm detyra kryesore, jo të fshira; "soon" = brenda 7 ditëve pas nesërmes; pa afat → `later`; afat i kaluar dhe `done=false` → `overdue`; grupet bosh nuk kthehen); `subtasksOf(tasks: Task[], parentId: string): Task[]`; `addSubtask(parent: Task, title: string): Promise<Task>` (hedh `Error('depth')` nëse `parent.parent_id` nuk është null).
- Shfaqja e etiketave të grupeve: `overdue`→"Vonuar", `today`→"Sot", `tomorrow`→"Nesër", `soon`→"Së shpejti", `later`→"Më vonë".

- [ ] **Step 1: Teste që dështojnë:** gjashtë detyra me afate të ndryshme shpërndahen saktë; detyra pa afat shkon te `later`; detyra e kaluar e pakryer shkon te `overdue` (Review Focus 4); `addSubtask` mbi nëndetyrë hedh `depth`; nëndetyrat nuk dalin si detyra kryesore.
- [ ] **Step 2: Ekzekuto** — FAIL.
- [ ] **Step 3: Implemento;** krahasimi i datave sipas ditës lokale (jo UTC).
- [ ] **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: task grouping and subtasks`.

---

### Task 6: Skema Supabase dhe RLS

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tabelat `notes, task_lists, tasks, tags, note_tags, task_tags, push_subscriptions` me kolonat e `types.ts` (pa `dirty`); `user_id uuid default auth.uid()`; indeks mbi `(user_id, updated_at)`; RLS e aktivizuar me politika `using (user_id = auth.uid()) with check (user_id = auth.uid())`; tabelat shtuar te publikimi `supabase_realtime`.

- [ ] **Step 1: Shkruaj migrimin SQL** me të gjitha tabelat, kufizimin `priority in ('low','medium','high')` dhe politikat RLS.
- [ ] **Step 2: Aplikoje** në një projekt Supabase (`supabase db push` ose SQL Editor) — pritet pa gabime.
- [ ] **Step 3: Verifiko RLS:** me dy përdorues testues, përdoruesi B nuk sheh asnjë rresht të A (`select count(*)` = 0) dhe nuk mund të shtojë me `user_id` të A.
- [ ] **Step 4: Commit** `feat: supabase schema with RLS`.

---

### Task 7: Hyrja (magic link) dhe klienti Supabase

**Files:**
- Create: `src/sync/supabase.ts`, `src/auth/AuthGate.tsx`, `.env.example`
- Modify: `src/App.tsx`
- Test: `tests/auth/AuthGate.test.tsx`

**Interfaces:**
- Produces: `supabase` (klient nga `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); `AuthGate({ children })` — pa sesion shfaq formularin e emailit ("Dërgo lidhjen e hyrjes"), me sesion rendit `children` dhe thërret `setCurrentUser(session.user.id)`. **Nëse nuk ka rrjet dhe ekziston përdorues i ruajtur lokalisht, hap aplikacionin offline.**

- [ ] **Step 1: Teste që dështojnë** (me klient të simuluar): pa sesion del formulari; me sesion dalin fëmijët; dërgimi i emailit thërret `signInWithOtp({ email })`; email bosh tregon gabim "Shkruaj email-in" dhe nuk dërgon.
- [ ] **Step 2: Ekzekuto** — FAIL.
- [ ] **Step 3: Implemento** `supabase.ts` dhe `AuthGate`; mbështill `App` me të.
- [ ] **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: magic link auth gate`.

---

### Task 8: Motori i sinkronizimit

**Files:**
- Create: `src/sync/engine.ts`
- Test: `tests/sync/engine.test.ts`

**Interfaces:**
- Consumes: `db`, `repo` (Task 2), `supabase` (Task 7).
- Produces: `type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'`; `pushDirty(remote: RemoteApi): Promise<void>`; `pullChanges(remote: RemoteApi): Promise<void>`; `syncNow(remote?: RemoteApi): Promise<void>`; `onStatus(cb: (s: SyncStatus) => void): () => void`; `startAutoSync(): () => void` (provon kur kthehet `online`, çdo 30 s kur ka dirty, pas çdo shkrimi). `RemoteApi = { upsert(table, rows): Promise<void>; fetchSince(table, since: string): Promise<BaseRow[]> }` — implementimi real mbi `supabase`, versioni i simuluar për teste.
- Rregullat: `pushDirty` fshin `dirty` vetëm pasi `upsert` ka sukses; `pullChanges` zbaton rreshtin e largët vetëm nëse `remote.updated_at > local.updated_at` (ose lokali s'ekziston) dhe e ruan me `dirty=0`; kursori `lastPulledAt` për tabelë ruhet në Dexie; rreshtat e fshirë (`deleted=true`) përhapen si çdo ndryshim tjetër.

- [ ] **Step 1: Teste që dështojnë** me `fake-indexeddb` dhe `RemoteApi` të simuluar: `push dërgon vetëm dirty dhe i pastron pas suksesit`; `push që hedh gabim lë dirty=1` (Review Focus 5); `pull i ri e zëvendëson lokalin më të vjetër`; `pull më i vjetër nuk e prek lokalin më të ri`; `dy ndryshime të të njëjtit rresht — mbetet ai me updated_at më të vonë, një rresht i vetëm` (Review Focus 3); `rreshti i fshirë nga pajisja tjetër shfaqet deleted=true`; `status kalon syncing → synced, dhe offline kur remote hedh gabim rrjeti`.
- [ ] **Step 2: Ekzekuto** — FAIL.
- [ ] **Step 3: Implemento** `engine.ts` sipas rregullave; `startAutoSync` dëgjon `window` `online`/`offline`.
- [ ] **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: offline-first sync engine`.

---

### Task 9: Realtime

**Files:**
- Create: `src/sync/realtime.ts`
- Modify: `src/App.tsx` (nis auto-sync dhe realtime pas hyrjes)
- Test: `tests/sync/realtime.test.ts`

**Interfaces:**
- Consumes: `pullChanges`, `syncNow` (Task 8), `supabase`.
- Produces: `startRealtime(userId: string): () => void` — abonohet te ndryshimet `postgres_changes` për të gjitha tabelat dhe thërret `syncNow()` (jo zbatim të drejtpërdrejtë të payload-it, që LWW të mbetet në një vend).

- [ ] **Step 1: Test që dështon:** një ngjarje e simuluar nga kanali shkakton saktësisht një thirrje `syncNow`; funksioni i kthyer çabonon kanalin.
- [ ] **Step 2: Ekzekuto** — FAIL. **Step 3: Implemento.** **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: realtime-triggered sync`.

---

### Task 10: Guaska e ndërfaqes, tema dhe treguesi

**Files:**
- Create: `src/ui/Shell.tsx`, `src/ui/SyncIndicator.tsx`, `src/ui/theme.css`
- Modify: `src/App.tsx` (routes `/notes`, `/tasks`, ridrejtim nga `/`)
- Test: `tests/ui/Shell.test.tsx`

**Interfaces:**
- Consumes: `onStatus` (Task 8).
- Produces: `Shell` — skeda "Shënime" / "Detyra" lart majtas në ekran ≥ 768px, shirit poshtë në më të ngushtë; `SyncIndicator` — tekstet "sinkronizuar", "duke sinkronizuar…", "offline", "gabim sinkronizimi — provohet përsëri". `theme.css` — variabla ngjyrash për çelët/errët me `prefers-color-scheme`.

- [ ] **Step 1: Teste që dështojnë:** `SyncIndicator` shfaq tekstin e saktë për secilën nga katër gjendjet; `Shell` ka lidhje drejt `/notes` dhe `/tasks`.
- [ ] **Step 2: Ekzekuto** — FAIL. **Step 3: Implemento.** **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: app shell, theme, sync indicator`.

---

### Task 11: Ekrani i shënimeve

**Files:**
- Create: `src/ui/notes/NotesPage.tsx`, `NotesTree.tsx`, `NoteEditor.tsx`
- Test: `tests/ui/notes/NotesPage.test.tsx`

**Interfaces:**
- Consumes: `buildTree`, `moveNote`, `deleteNoteCascade` (Task 4), `repo` (Task 2), `keyForIndex` (Task 3).
- Produces: `NotesPage` — pema (degë që hapen/mbyllen; "Shënim i ri" në rrënjë dhe brenda një shënimi; tërheqje me `@dnd-kit` thërret `moveNote`; ikonë folder kur ka fëmijë), editor me titull dhe `textarea` Markdown me pamje paraprake të formatuar (`react-markdown`), breadcrumb nga rrugën e prindërve; në telefon pema hapet si menu anësore. Ruajtja automatike pas 500 ms pa shkrim.

- [ ] **Step 1: Teste që dështojnë** (Dexie e simuluar): krijimi i shënimit të ri e shfaq në pemë; krijimi brenda një shënimi e bën fëmijë dhe e hap prindin; ndryshimi i titullit e ruan në `db` me `dirty=1`; Markdown `**bold**` shfaqet si `<strong>`; përpjekja për ta tërhequr shënimin brenda pasardhësit nuk e ndryshon pemën.
- [ ] **Step 2: Ekzekuto** — FAIL. **Step 3: Implemento.** **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Verifikim vizual:** `npm run dev`, hap `/notes` në dritare desktop dhe në emulim mobile (375px); pema, editori dhe menuja anësore punojnë.
- [ ] **Step 6: Commit** `feat: notes screen`.

---

### Task 12: Ekrani i detyrave

**Files:**
- Create: `src/ui/tasks/TasksPage.tsx`, `TaskLists.tsx`, `TaskItem.tsx`
- Test: `tests/ui/tasks/TasksPage.test.tsx`

**Interfaces:**
- Consumes: `groupTasks`, `subtasksOf`, `addSubtask` (Task 5), `repo`.
- Produces: `TasksPage` — lista sipër ("Të gjitha", listat e krijuara, "+" për listë të re), detyrat e grupuara me etiketat shqip të Task 5; `TaskItem` — rreth për `done` (kryerja e vë `done=true` dhe e pret me vijë), titull i madh (≥ 16px), prioriteti dhe ikona e kujtesës djathtas, nëndetyrat më brenda dhe më të vogla, butoni "+ Detyrë e re" poshtë; hapja e detyrës ofron afat, kujtesë, prioritet, përshkrim Markdown.

- [ ] **Step 1: Teste që dështojnë:** shtimi i detyrës e vendos në grupin e duhur sipas afatit; klikimi i rrethit e shënon `done`; nëndetyra del më brenda nën prindin dhe nuk lejohet nën-nëndetyrë; krijimi i listës e shton te skedat; filtrimi sipas listës tregon vetëm detyrat e saj.
- [ ] **Step 2: Ekzekuto** — FAIL. **Step 3: Implemento.** **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Verifikim vizual** në 375px: grupet, rrathët dhe nëndetyrat duken sipas skicës së miratuar.
- [ ] **Step 6: Commit** `feat: tasks screen`.

---

### Task 13: Etiketat

**Files:**
- Create: `src/ui/tags/TagFilter.tsx`
- Modify: `src/ui/notes/NotesPage.tsx`, `src/ui/tasks/TasksPage.tsx`
- Test: `tests/ui/tags/TagFilter.test.tsx`

**Interfaces:**
- Produces: `TagFilter({ selectedTagId, onChange })`; `filterByTag<T extends { id: string }>(items: T[], links: { item_id: string; tag_id: string }[], tagId: string | null): T[]` (`tagId = null` → të gjitha). Shtimi/heqja e etiketës te shënimi/detyra përmes `note_tags`/`task_tags`.

- [ ] **Step 1: Teste që dështojnë:** `filterByTag` me `null` kthen të gjitha; me një etiketë kthen vetëm lidhjet e saj; etiketa e fshirë nuk shfaqet.
- [ ] **Step 2: Ekzekuto** — FAIL. **Step 3: Implemento.** **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: tags and filtering`.

---

### Task 14: Kujtesat (Web Push)

**Files:**
- Create: `src/push/subscribe.ts`, `src/push/sw.ts`, `supabase/functions/send-reminders/index.ts`
- Modify: `vite.config.ts` (strategjia `injectManifest` me `src/push/sw.ts`)
- Test: `tests/push/subscribe.test.ts`, `supabase/functions/send-reminders/index.test.ts`

**Interfaces:**
- Produces: `subscribeToPush(): Promise<'granted' | 'denied' | 'unsupported'>` — kërkon leje, merr `PushSubscription` me çelësin VAPID publik (`VITE_VAPID_PUBLIC_KEY`) dhe e ruan në `push_subscriptions`; `sw.ts` — dëgjon `push`, shfaq njoftimin (titulli i detyrës) dhe në `notificationclick` hap `/tasks`; Edge Function `send-reminders` — gjen `tasks` me `remind_at <= now()`, `done=false`, `deleted=false`, `reminded_at is null`, dërgon push te `push_subscriptions` të `user_id` dhe vendos `reminded_at = now()`; subscription me përgjigje 404/410 fshihet. Shton kolonën `reminded_at timestamptz` te `tasks` (migrim `0002_reminded_at.sql`); ndryshimi i `remind_at` e zeron `reminded_at`.
- Cron: `pg_cron` thërret funksionin çdo minutë.

- [ ] **Step 1: Teste që dështojnë:** `subscribeToPush` kthen `denied` kur leja refuzohet, `unsupported` pa `PushManager`, dhe e ruan subscription kur lejohet; logjika e përzgjedhjes në funksion zgjedh vetëm detyrat e arritura, të pakryera, të paformuluara më parë; subscription 410 fshihet.
- [ ] **Step 2: Ekzekuto** — FAIL. **Step 3: Implemento** të tri pjesët dhe migrimin 0002; vendos sekretet VAPID në Supabase.
- [ ] **Step 4: Ekzekuto** — PASS.
- [ ] **Step 5: Commit** `feat: reminders via web push`.

---

### Task 15: PWA offline, instalimi dhe deploy

**Files:**
- Create: `public/icons/*` (192, 512, maskable), `netlify.toml`
- Modify: `vite.config.ts` (manifest: `name`, `short_name`, `lang: 'sq'`, `display: 'standalone'`, ikona), `index.html`

**Interfaces:**
- Produces: aplikacion i instalueshëm që hapet offline pas vizitës së parë; deploy në Netlify me ridrejtim SPA (`/* → /index.html 200`) dhe variablat `VITE_*` të vendosura në Netlify.

- [ ] **Step 1: Konfiguro manifestin dhe `netlify.toml`;** `npm run build` — pritet pa gabime dhe `dist/manifest.webmanifest` ekziston.
- [ ] **Step 2: Deploy** në Netlify (lidhur me repon GitHub) dhe verifiko që faqja hapet.
- [ ] **Step 3: Verifikim manual në praktikë** (lista më poshtë) dhe regjistro rezultatin.
- [ ] **Step 4: Commit** `feat: pwa manifest and netlify deploy`.

**Lista e verifikimit manual (përpara se të deklarohet gati):**
1. Instalimi në Chrome/Edge në PC dhe në Chrome Android.
2. Shënim i shkruar në PC shfaqet në telefon brenda pak sekondash (të dyja online).
3. Modalitet avioni në telefon: krijo shënim dhe detyrë, çaktivizo modalitetin → sinkronizohen në PC.
4. Kujtesë me aplikacionin të mbyllur në Android → njoftimi vjen në kohë.
5. Përdorues i dytë nuk sheh asgjë nga të dhënat e para.

---

## Self-review (i kryer)

- **Mbulimi i specifikimit:** §2 teknologjitë → Task 1, 15; §3 modeli → Task 2, 4, 5, 6; RLS → Task 6; §4 sinkronizimi → Task 3, 8, 9; §5 kujtesat → Task 14; §6 ekranet → Task 10–13; §7 gabimet → Task 7, 8, 10; §8 testimi → çdo task + lista manuale. Hyrja (magic link) → Task 7.
- **Konsistenca e tipeve:** `BaseRow`, `repo.create/update/softDelete/list`, `keyForIndex`, `buildTree`, `moveNote`, `groupTasks`, `RemoteApi`, `SyncStatus` përdoren me të njëjtat emra në të gjithë planin.
- **Review Focus:** secila nga pesë linjat ka testin e saj në task-un përkatës (Task 4, 5, 8).
- **Shënim:** `reminded_at` nuk është në spec; shtohet në Task 14 si detaj implementimi për të mos dërguar kujtesën dy herë.
