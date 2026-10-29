-- Migration 2026-10-29: requirement decisions and owner bootstrap.
-- For a project that already ran an earlier supabase.sql. Safe to run more
-- than once; touches no survey data.
-- The owner is set once, by you, in the SQL editor, with your own email:
--
--   select public.dev_set_owner('you@example.com');
--
-- It does nothing if an owner already exists, so re-running this file never
-- changes who the owner is. Nothing in the app can add another owner or
-- remove the owner row.
create or replace function public.dev_set_owner(owner_email text)
returns text
language plpgsql
security definer
set search_path = public
as $
begin
  if exists (select 1 from public.dev_members where role = 'owner') then
    return 'An owner already exists; nothing changed.';
  end if;
  insert into public.dev_members (email, role) values (lower(trim(owner_email)), 'owner');
  return 'Owner set to ' || lower(trim(owner_email));
end;
$;
-- Only the SQL editor (postgres role) should call this.
revoke all on function public.dev_set_owner(text) from public, anon, authenticated;

-- The signed-in account’s role, or null. Security definer so it can read
-- dev_members regardless of that table’s own policies.
create or replace function public.dev_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.dev_members
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

revoke all on function public.dev_role() from public;
grant execute on function public.dev_role() to authenticated;


-- Database-requirement decisions: the research team’s status and rationale
-- per catalogue item (see src/dev/insights.ts). Same rules as plant_reviews.
create table if not exists public.requirement_reviews (
  requirement_id text primary key,
  status         text not null default proposed check (status in (proposed, include, defer, exclude)),
  rationale      text,
  updated_by     text,
  updated_at     timestamptz not null default now()
);

alter table public.requirement_reviews enable row level security;

drop policy if exists "members read decisions" on public.requirement_reviews;
create policy "members read decisions"
  on public.requirement_reviews
  for select
  to authenticated
  using (public.dev_role() is not null);

drop policy if exists "editors write decisions" on public.requirement_reviews;
create policy "editors write decisions"
  on public.requirement_reviews
  for all
  to authenticated
  using (public.dev_role() in (owner, editor))
  with check (public.dev_role() in (owner, editor));

revoke all on public.requirement_reviews from anon;
grant select, insert, update, delete on public.requirement_reviews to authenticated;
