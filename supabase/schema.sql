-- The Red Room — Supabase database schema.
--
-- Run this once: Supabase dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run. It is safe to re-run; every statement is
-- idempotent.

-- ----------------------------------------------------------------------
-- profiles: one row per user. Holds the plan and monthly usage counter.
--
-- Card/payment data is NEVER stored here. Stripe holds all of that. We
-- keep only `stripe_customer_id`, an opaque reference like 'cus_abc123'.
-- ----------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  plan               text not null default 'free',
  stripe_customer_id text,
  reviews_used       integer not null default 0,
  quota_reset_at     timestamptz not null default (now() + interval '1 month'),
  -- One-time 7-day trial of the Writer tier. trial_ends_at in the future
  -- means the trial is active; trial_started stays true forever so the
  -- trial cannot be taken twice.
  trial_started      boolean not null default false,
  trial_ends_at      timestamptz,
  created_at         timestamptz not null default now()
);

-- Add the trial columns if an older version of this table already exists.
alter table public.profiles
  add column if not exists trial_started boolean not null default false;
alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

alter table public.profiles enable row level security;

-- A signed-in user may READ their own profile. There is deliberately NO
-- insert/update/delete policy: `plan` and `reviews_used` are written only
-- by the backend with the service-role key (which bypasses RLS). This is
-- what stops a user from granting themselves a paid plan.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- ----------------------------------------------------------------------
-- Auto-create a profile row the moment a new account is created.
-- ----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------
-- Backfill: give a profile to any account created before this table did.
-- ----------------------------------------------------------------------
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
