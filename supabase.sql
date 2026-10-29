-- Full setup for a new Supabase project. Run the whole file in the SQL editor
-- (Dashboard → SQL Editor → New query → Run). Safe to run again later: it
-- creates what is missing and never touches survey responses.
--
-- After running it once, set the owner with your own email:
--
--   select public.dev_set_owner('you@example.com');

-- ---------------------------------------------------------------------------
-- Survey responses. One row per submitted survey. No IP, no email, no user id.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  duration_seconds integer,
  questions_version integer,
  answers jsonb not null
);

-- Row Level Security: the public anon key may only insert, never read,
-- update or delete.
alter table public.responses enable row level security;

drop policy if exists "anonymous insert only" on public.responses;
create policy "anonymous insert only"
  on public.responses
  for insert
  to anon
  with check (true);

revoke all on public.responses from anon;
grant insert on public.responses to anon;

-- Refuse absurdly large payloads (about 64 KB).
alter table public.responses
  drop constraint if exists responses_answers_size,
  add constraint responses_answers_size check (pg_column_size(answers) < 65536);

-- ---------------------------------------------------------------------------
-- Developer mode access. The site signs people in by magic link (Supabase
-- Auth, email provider). Whether a signed-in account may read anything is
-- decided here, by the dev_members table and Row Level Security, never by
-- the front end alone.
--
-- Roles:  owner   – set once with dev_set_owner(); grants and removes access
--         editor  – reads everything; changes plant and requirement decisions
--         viewer  – reads everything, including raw responses
-- ---------------------------------------------------------------------------

create table if not exists public.dev_members (
  email      text primary key,
  role       text not null check (role in ('owner', 'editor', 'viewer')),
  invited_by text,
  created_at timestamptz not null default now()
);

-- Sets the owner once. Does nothing if an owner already exists, so re-running
-- never changes who the owner is. Nothing in the app can add another owner or
-- remove the owner row.
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

-- Responses: every member may read; nobody edits through the API.
drop policy if exists "owner reads" on public.responses;
drop policy if exists "members read" on public.responses;
create policy "members read"
  on public.responses
  for select
  to authenticated
  using (public.dev_role() is not null);

grant select on public.responses to authenticated;

-- Members: all members can see the list; only the owner changes it, and the
-- owner row itself cannot be changed or removed through the API.
alter table public.dev_members enable row level security;

drop policy if exists "members see members" on public.dev_members;
create policy "members see members"
  on public.dev_members
  for select
  to authenticated
  using (public.dev_role() is not null);

drop policy if exists "owner invites" on public.dev_members;
create policy "owner invites"
  on public.dev_members
  for insert
  to authenticated
  with check (public.dev_role() = 'owner' and role in ('editor', 'viewer'));

drop policy if exists "owner changes roles" on public.dev_members;
create policy "owner changes roles"
  on public.dev_members
  for update
  to authenticated
  using (public.dev_role() = 'owner' and role <> 'owner')
  with check (role in ('editor', 'viewer'));

drop policy if exists "owner removes" on public.dev_members;
create policy "owner removes"
  on public.dev_members
  for delete
  to authenticated
  using (public.dev_role() = 'owner' and role <> 'owner');

revoke all on public.dev_members from anon;
grant select, insert, update, delete on public.dev_members to authenticated;

-- ---------------------------------------------------------------------------
-- Reviewer decisions. Survey data is never changed; these tables sit beside it.
-- ---------------------------------------------------------------------------

-- Plant candidates: merged spellings, shortlist status, notes.
create table if not exists public.plant_reviews (
  name_key      text primary key,
  reviewed_name text,
  status        text not null default 'candidate' check (status in ('candidate', 'shortlisted', 'excluded')),
  merged_into   text,
  notes         text,
  updated_by    text,
  updated_at    timestamptz not null default now()
);

alter table public.plant_reviews enable row level security;

drop policy if exists "members read reviews" on public.plant_reviews;
create policy "members read reviews"
  on public.plant_reviews
  for select
  to authenticated
  using (public.dev_role() is not null);

drop policy if exists "editors write reviews" on public.plant_reviews;
create policy "editors write reviews"
  on public.plant_reviews
  for all
  to authenticated
  using (public.dev_role() in ('owner', 'editor'))
  with check (public.dev_role() in ('owner', 'editor'));

revoke all on public.plant_reviews from anon;
grant select, insert, update, delete on public.plant_reviews to authenticated;

-- Database requirements: status and rationale per catalogue item
-- (see src/dev/insights.ts).
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
