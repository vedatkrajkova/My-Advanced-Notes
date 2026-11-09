-- Kur u dërgua kujtesa; vendoset vetëm nga funksioni send-reminders.
alter table public.tasks add column reminded_at timestamptz;

-- Nëse ndryshon ora e kujtesës, kujtesa duhet të dërgohet përsëri.
create or replace function public.reset_reminded_at() returns trigger
language plpgsql as $$
begin
  if new.remind_at is distinct from old.remind_at then
    new.reminded_at := null;
  end if;
  return new;
end $$;

create trigger tasks_reset_reminded_at before update on public.tasks
  for each row execute function public.reset_reminded_at();

create index tasks_due_reminders_idx on public.tasks (remind_at)
  where reminded_at is null and done = false and deleted = false;
