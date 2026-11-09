-- Skema e aplikacionit të shënimeve dhe detyrave.
-- updated_at: koha e ndryshimit në klient (për "fiton më i vonshmi").
-- server_updated_at: vendoset nga serveri; përdoret vetëm si kursor për marrjen e ndryshimeve.

create or replace function public.set_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

-- "Fiton më i vonshmi" edhe në server: një përditësim me updated_at më të vjetër anashkalohet.
create or replace function public.keep_newer_row() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end $$;

create table public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted boolean not null default false,
  title text not null default '',
  content text not null default '',
  parent_id uuid,
  sort_key text not null,
  pinned boolean not null default false,
  icon text
);

create table public.task_lists (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted boolean not null default false,
  name text not null default '',
  sort_key text not null
);

create table public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted boolean not null default false,
  list_id uuid,
  parent_id uuid,
  title text not null default '',
  description text not null default '',
  done boolean not null default false,
  due_at timestamptz,
  remind_at timestamptz,
  priority text not null default 'medium' constraint tasks_priority_check check (priority in ('low', 'medium', 'high')),
  sort_key text not null
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted boolean not null default false,
  name text not null default '',
  color text not null default '#888888'
);

create table public.note_tags (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted boolean not null default false,
  note_id uuid not null,
  tag_id uuid not null
);

create table public.task_tags (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted boolean not null default false,
  task_id uuid not null,
  tag_id uuid not null
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null
);

do $$
declare t text;
begin
  foreach t in array array['notes', 'task_lists', 'tasks', 'tags', 'note_tags', 'task_tags'] loop
    execute format('create index %1$s_user_sync_idx on public.%1$I (user_id, server_updated_at)', t);
    execute format('create trigger %1$s_server_updated_at before insert or update on public.%1$I
                    for each row execute function public.set_server_updated_at()', t);
    execute format('create trigger %1$s_keep_newer before update on public.%1$I
                    for each row execute function public.keep_newer_row()', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;

  foreach t in array array['notes', 'task_lists', 'tasks', 'tags', 'note_tags', 'task_tags', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_rows on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
