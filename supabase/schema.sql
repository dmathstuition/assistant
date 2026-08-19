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

-- =====================================================================
--  MIGRATION: SAVINGS GOALS (added after Phase 1)
--  Paste this block on its own into Supabase → SQL Editor → Run.
--  A named savings target per user, with the amount saved so far. RLS
--  matches the other data tables so a user only sees/edits their own rows.
-- =====================================================================
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount >= 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

create index if not exists idx_savings_goals_user on public.savings_goals(user_id);

alter table public.savings_goals enable row level security;

drop policy if exists "own savings_goals" on public.savings_goals;
create policy "own savings_goals" on public.savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
--  MIGRATION: BUDGET ALERTS (added after Phase 1)
--  Paste this block on its own into Supabase → SQL Editor → Run.
--  One row per (category, threshold, month) alert already sent, so the
--  daily alert cron never emails the same 80%/100% crossing twice. Written
--  only by the service-role cron, but RLS is on and scoped for safety.
-- =====================================================================
create table if not exists public.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  threshold int not null check (threshold in (80, 100)),
  period text not null,               -- 'YYYY-MM' the alert applies to
  created_at timestamptz not null default now(),
  unique (user_id, category, threshold, period)
);

alter table public.budget_alerts enable row level security;

drop policy if exists "own budget_alerts" on public.budget_alerts;
create policy "own budget_alerts" on public.budget_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
--  MIGRATION: WEB PUSH SUBSCRIPTIONS (added after Phase 1)
--  Paste this block on its own into Supabase → SQL Editor → Run.
--  One row per device/browser the user enabled push on. The push cron
--  (service role) reads these to deliver notifications; RLS keeps the
--  browser able to manage only its own user's subscriptions.
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push_subscriptions" on public.push_subscriptions;
create policy "own push_subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
--  MIGRATION: RECURRING RULES (added after Phase 1)
--  Paste this block on its own into Supabase → SQL Editor → Run.
--  Templates that auto-create an expense or income on a schedule (rent,
--  salary, subscriptions). A daily cron inserts the transaction whenever
--  next_run is due, then advances next_run. RLS scopes rows to the owner.
-- =====================================================================
create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'Other',      -- category (expense) or source (income)
  description text,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  next_run date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recurring_user on public.recurring_rules(user_id);
create index if not exists idx_recurring_due on public.recurring_rules(active, next_run);

alter table public.recurring_rules enable row level security;

drop policy if exists "own recurring_rules" on public.recurring_rules;
create policy "own recurring_rules" on public.recurring_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
