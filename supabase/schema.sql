-- =====================================================================
--  D-MATHS Assistant — Phase 1 database schema
--  Run this in Supabase → SQL Editor → New query → paste → Run.
--  Row Level Security is ON for every table from the start, so each
--  user can only ever read or write their OWN rows.
-- =====================================================================

-- ---------- PROFILES (one row per user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

-- ---------- TASKS ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  due_time time,
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','overdue','cancelled')),
  category text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- EXPENSES ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'Other',
  description text,
  occurred_on date not null default current_date,
  source text not null default 'manual' check (source in ('manual','voice','ai')),
  created_at timestamptz not null default now()
);

-- ---------- INCOME ----------
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  source_name text not null default 'Other',
  description text,
  occurred_on date not null default current_date,
  source text not null default 'manual' check (source in ('manual','voice','ai')),
  created_at timestamptz not null default now()
);

-- ---------- REMINDERS (stored now; the cron that fires them comes later) ----------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  remind_at timestamptz not null,
  recurring text,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- indexes for the common per-user, by-date lookups ----------
create index if not exists idx_expenses_user_date on public.expenses(user_id, occurred_on);
create index if not exists idx_income_user_date   on public.income(user_id, occurred_on);
create index if not exists idx_tasks_user_status  on public.tasks(user_id, status);

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles  enable row level security;
alter table public.tasks     enable row level security;
alter table public.expenses  enable row level security;
alter table public.income    enable row level security;
alter table public.reminders enable row level security;

-- profiles: user sees/edits only their own row
drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- data tables: full access to your own rows only
drop policy if exists "own tasks" on public.tasks;
drop policy if exists "own expenses" on public.expenses;
drop policy if exists "own income" on public.income;
drop policy if exists "own reminders" on public.reminders;
create policy "own tasks"     on public.tasks     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own expenses"  on public.expenses  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own income"    on public.income    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reminders" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
--  AUTO-CREATE A PROFILE ROW WHEN A USER SIGNS UP
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  KEEP-ALIVE (prevents free-tier auto-pause). Written to only by the
--  daily cron using the service-role key, so no RLS policy is needed.
-- =====================================================================
create table if not exists public.keep_alive (
  id bigint generated by default as identity primary key,
  pinged_at timestamptz not null default now()
);
alter table public.keep_alive enable row level security;

-- =====================================================================
--  MIGRATION: BUDGETS (added after Phase 1)
--  Paste this block on its own into Supabase → SQL Editor → Run.
--  One monthly spending limit per category, per user. RLS matches the
--  other data tables so a user only ever sees or edits their own rows.
-- =====================================================================
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(14,2) not null check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

create index if not exists idx_budgets_user on public.budgets(user_id);

alter table public.budgets enable row level security;

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
