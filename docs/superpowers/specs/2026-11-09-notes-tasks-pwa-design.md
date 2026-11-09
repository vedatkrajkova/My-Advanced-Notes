# Aplikacion shënimesh dhe detyrash (PWA) — specifikim dizajni

Data: 2026-11-09

## 1. Qëllimi

Aplikacion personal për shënime dhe detyra, për një përdorues të vetëm, që punon në PC dhe në telefon Android (si web mobile e instalueshme). Të dhënat sinkronizohen mes pajisjeve dhe aplikacioni punon pa internet.

**Kriteret e suksesit**
- Një shënim ose detyrë e shkruar në PC shfaqet në telefon brenda pak sekondash kur të dyja janë online.
- Pa internet nuk humbet asgjë; ndryshimet sinkronizohen kur lidhja kthehet.
- Kujtesat njoftojnë në kohë edhe kur aplikacioni është i mbyllur (pasi pajisja ka qenë online pas vendosjes së kujtesës).
- Vetëm përdoruesi i identifikuar sheh të dhënat e veta.

**Jashtë fushës (V1):** iPhone, bashkëpunim ose ndarje me të tjerë, lidhje me Google Drive / OneDrive / Mega / Box, aplikacion desktop native (Tauri), skedarë të bashkëngjitur.

## 2. Qasja dhe teknologjitë

PWA me një kod të vetëm.
- **React + TypeScript + Vite**, **vite-plugin-pwa** (instalim + service worker).
- **Dexie.js** (IndexedDB): databaza lokale. Ndërfaqja lexon dhe shkruan vetëm këtu.
- **Supabase** (plan falas): Postgres, hyrje me email (magic link), Realtime, funksione të planifikuara.
- **Netlify** (plan falas): hostimi i faqes.
- Gjuha e ndërfaqes: shqip. Tema e çelët dhe e errët sipas pajisjes.

```
Ndërfaqja ⇄ Dexie (lokal) ⇄ Moduli i sinkronizimit ⇄ Supabase ⇄ pajisja tjetër
```

## 3. Modeli i të dhënave

Tabelat janë të njëjta në Dexie dhe Supabase. Çdo rresht ka `id` (UUID i krijuar në klient), `user_id`, `created_at`, `updated_at`, `deleted` (fshirje e butë, që të sinkronizohet).

- **notes**: `title`, `content` (Markdown), `parent_id` (null = rrënjë), `sort_key`, `pinned`, `icon`.
- **task_lists**: `name`, `sort_key`.
- **tasks**: `list_id`, `parent_id` (një nivel nëndetyrash), `title`, `description` (Markdown), `done`, `due_at`, `remind_at`, `priority` (low/medium/high), `sort_key`.
- **tags**: `name`, `color`.
- **note_tags**, **task_tags**: lidhje shumë-me-shumë.
- **push_subscriptions**: `endpoint`, çelësat e pajisjes (për njoftimet).

**Hierarkia e shënimeve:** një shënim mund të ketë tekst dhe nën-shënime, pa kufi thellësie, si në Notion. "Folder" është shënim me fëmijë; ikona e bën të duket si folder. Ndalohet vendosja e një shënimi brenda pasardhësve të vet.

**Sigurësia:** Row Level Security në çdo tabelë Supabase: `user_id = auth.uid()`.

## 4. Sinkronizimi

- Çdo ndryshim ruhet menjëherë në Dexie dhe shënohet "pa dërguar". Ndërfaqja nuk pret rrjetin.
- **Dërgimi:** rreshtat "pa dërguar" shkojnë në Supabase kur ka internet, me rishtim automatik pas dështimit.
- **Marrja:** merren vetëm rreshtat me `updated_at` më të ri se sinkronizimi i fundit. Kur je online, Supabase Realtime sjell ndryshimet brenda pak sekondash.
- **Konfliktet:** fiton ndryshimi me `updated_at` më të vonë (last-write-wins, për rresht). Kufizim i njohur: redaktimi i të njëjtit shënim offline në dy pajisje humb versionin më të hershëm.
- **Renditja:** `sort_key` fraksional (si "fractional indexing"), që zhvendosjet në dy pajisje të mos përplasen.
- **Treguesi:** ✓ sinkronizuar / ⟳ duke sinkronizuar / ⚠ offline.

## 5. Kujtesat

- Një funksion i planifikuar në Supabase (çdo minutë) gjen detyrat me `remind_at` të arritur dhe dërgon Web Push te të gjitha pajisjet e regjistruara.
- Android: aplikacioni duhet të instalohet dhe njoftimet të lejohen. PC: Chrome ose Edge duhet të punojë në sfond.
- Kufizim: kujtesa e vendosur pa internet arrin serverin vetëm pasi pajisja të lidhet.
- Plani falas i Supabase pezullohet pas 7 ditësh pa përdorim; me përdorim të rregullt nuk ndodh.

## 6. Ekranet dhe pamja

Dy seksione kryesore: **Shënime** dhe **Detyra** (skeda në PC, shirit poshtë në telefon). Treguesi i sinkronizimit lart.

- **PC, shënime:** pema në të majtë (degë që hapen/mbyllen, tërheqje për zhvendosje); në të djathtë shënimi me rrugën (breadcrumb), titull dhe editor Markdown me pamje të formatuar.
- **Telefon, shënime:** pema hapet si menu anësore; shënimi mbush ekranin.
- **Detyra:** lista në krye si në Google Tasks (Të gjitha, lista të tjera, +). Detyrat grupohen sipas datës (Sot, Nesër, Së shpejti, Më vonë). Stili frymëzohet nga Any.do (font i madh, rrathë për kryerjen, nëndetyra më brenda dhe më të vogla, të kryerat me vijë). Prioriteti dhe kujtesa në të djathtë të detyrës; butoni "Detyrë e re" poshtë.
- Etiketat filtrojnë si shënimet ashtu edhe detyrat.

## 7. Trajtimi i gabimeve

- Dështimi i sinkronizimit nuk bllokon ndërfaqen; treguesi shfaq gjendjen dhe provohet përsëri.
- Nëse sesioni skadon, përdoruesi ri-hyn dhe të dhënat lokale mbeten.
- Fshirja është e butë; kosh me rikthim mund të shtohet më vonë.

## 8. Testimi

- Njësi: logjika e sinkronizimit (dërgim, marrje, konflikt), renditja me `sort_key`, ndalimi i ciklit në hierarki.
- Integrim: sinkronizimi Dexie ⇄ Supabase mbi projekt testimi.
- Manual: instalimi në Android dhe PC, puna offline, njoftimi i kujtesës me aplikacionin të mbyllur.

## 9. Zgjerime të mundshme më vonë

Lidhje me drive-et (backup ose bashkëngjitje), aplikacion Tauri për njoftime native në PC, kosh me rikthim.
