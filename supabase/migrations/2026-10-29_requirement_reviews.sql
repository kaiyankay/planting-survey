-- Migration 2026-10-29: owner bootstrap function and requirement decisions.
-- For a project that already ran an earlier supabase.sql. Safe to run more
-- than once; touches no survey data. (A fresh project runs supabase.sql
-- instead, which already contains all of this.)

create or replace function public.dev_set_owner(owner_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.dev_members where role = 'owner') then
    return 'An owner already exists; nothing changed.';
  end if;
  insert into public.dev_members (email, role) values (lower(trim(owner_email)), 'owner');
  return 'Owner set to ' || lower(trim(owner_email));
end;
$$;

revoke all on function public.dev_set_owner(text) from public, anon, authenticated;

create table if not exists public.requirement_reviews (
  requirement_id text primary key,
  status         text not null default 'proposed' check (status in ('proposed', 'include', 'defer', 'exclude')),
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
  using (public.dev_role() in ('owner', 'editor'))
  with check (public.dev_role() in ('owner', 'editor'));

revoke all on public.requirement_reviews from anon;
grant select, insert, update, delete on public.requirement_reviews to authenticated;
