# Shënime dhe detyra

Aplikacion personal (PWA) për shënime dhe detyra, për PC dhe Android, me sinkronizim dhe punë offline.

- **Shënime**: pemë pa kufi thellësie (si në Notion), tekst në Markdown, etiketa.
- **Detyra**: lista (si në Google Tasks), nëndetyra, afat, prioritet, kujtesa me njoftime, grupim Sot / Nesër / Së shpejti.
- **Offline-first**: gjithçka ruhet në pajisje (IndexedDB) dhe sinkronizohet me Supabase kur ka internet.

## Zhvillimi

```bash
npm install
npm run dev
```

```bash
npm test
```

Pa `.env.local` aplikacioni punon vetëm në pajisjen tënde. Për hyrjen, sinkronizimin, kujtesat dhe publikimin shih [docs/setup.md](docs/setup.md).

## Struktura

- `src/domain`: logjika (pema e shënimeve, grupimi i detyrave, renditja).
- `src/db`: databaza lokale (Dexie).
- `src/sync`: sinkronizimi me Supabase dhe Realtime.
- `src/ui`: ekranet.
- `src/push`: njoftimet dhe service worker.
- `supabase/`: migrimet SQL dhe funksioni `send-reminders`.
- `docs/superpowers/`: specifikimi dhe plani.
