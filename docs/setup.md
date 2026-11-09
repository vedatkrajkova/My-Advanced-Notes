# Konfigurimi: Supabase, njoftimet dhe Netlify

Aplikacioni punon edhe pa këto hapa, por vetëm në një pajisje ("vetëm në këtë pajisje"). Hapat më poshtë aktivizojnë hyrjen, sinkronizimin mes PC-së dhe telefonit, dhe kujtesat.

Kur të hysh për herë të parë, shënimet dhe detyrat e krijuara në modalitetin lokal kalojnë automatikisht te llogaria jote.

## 1. Projekti në Supabase

1. Krijo një projekt falas në <https://supabase.com>.
2. Te **SQL Editor**, ekzekuto me radhë:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_reminded_at.sql`
3. Te **Authentication → URL Configuration**:
   - **Site URL**: adresa e Netlify (p.sh. `https://emri-yt.netlify.app`).
   - **Redirect URLs**: shto të njëjtën adresë dhe `http://localhost:5173` për zhvillim.
4. Te **Project Settings → API** merr `Project URL` dhe çelësin `anon public`.

## 2. Çelësat VAPID (për njoftimet)

Në kompjuterin tënd:

```bash
npx web-push generate-vapid-keys
```

Çelësi **publik** shkon te Netlify (hapi 4). Çelësi **privat** shkon vetëm te sekretet e Supabase (hapi 3) dhe nuk duhet ndarë me askënd.

## 3. Funksioni i kujtesave

Me [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref <REF-I-PROJEKTIT>
supabase secrets set VAPID_PUBLIC_KEY=<publik> VAPID_PRIVATE_KEY=<privat> VAPID_SUBJECT=mailto:<email-i-yt> CRON_SECRET=<një-fjalë-e-gjatë-e-rastësishme>
supabase functions deploy send-reminders --no-verify-jwt
```

Pastaj, te **SQL Editor**, aktivizo ekzekutimin çdo minutë (zëvendëso `<REF>` dhe `<CRON_SECRET>`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://<REF>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     ) $$
);
```

## 4. Netlify

1. Te Netlify: **Add new site → Import from GitHub**, zgjidh `My-Advanced-Notes`. `netlify.toml` e plotëson vetë komandën dhe dosjen.
2. Te **Site configuration → Environment variables** shto:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = çelësi `anon public`
   - `VITE_VAPID_PUBLIC_KEY` = çelësi publik VAPID
3. Bëj deploy përsëri pasi të shtosh variablat.

Për zhvillim lokal, kopjo `.env.example` në `.env.local` dhe plotësoje.

## 5. Instalimi

- **PC (Chrome/Edge)**: hap faqen dhe kliko ikonën e instalimit në shiritin e adresës.
- **Android (Chrome)**: menuja ⋮ → **Instalo aplikacionin** (ose **Shto në ekranin kryesor**).
- Kur vendos kujtesën e parë, lejo njoftimet.

## 6. Lista e verifikimit

1. Aplikacioni instalohet në PC dhe në Android.
2. Një shënim i shkruar në PC shfaqet në telefon brenda pak sekondash (të dyja online).
3. Telefoni në modalitet avioni: krijo një shënim dhe një detyrë, pastaj fike modalitetin. Të dyja duhet të shfaqen në PC.
4. Vendos një kujtesë pas 2 minutash dhe mbyll aplikacionin në Android. Njoftimi duhet të vijë.
5. Hyr me një email tjetër: nuk duhet të shohësh asgjë nga të dhënat e para.
