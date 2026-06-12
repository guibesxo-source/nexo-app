-- =============================================================
-- Nexo · Migration inicial — schema base multi-tenant com RLS
-- Fonte: docs/05-modelo-de-dados.md (repo do protótipo), com as
-- extensões que a UI da F2 já usa: events.capacity, attendees.ticket
-- e budget_categories.icon. Aplicar quando o projeto Supabase nascer:
--   supabase db push  (ou via SQL editor do dashboard)
-- =============================================================

-- Enums
create type membership_role as enum ('owner','admin','member','viewer');
create type event_status    as enum ('rascunho','planejamento','confirmado','encerrado','cancelado');
create type attendee_status as enum ('pendente','confirmado','checkin','cancelado');
create type task_status     as enum ('aberta','concluida');
create type tx_kind         as enum ('entrada','saida');
create type tx_payment      as enum ('pago','pendente','recebido');

-- Perfil (1:1 com auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Workspace (tenant)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text default 'America/Sao_Paulo',
  owner_id uuid not null references profiles(id),
  created_at timestamptz default now()
);

-- Vínculo usuário ↔ workspace
create table memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz default now(),
  unique (workspace_id, user_id)
);

-- Evento
create table events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  status event_status not null default 'planejamento',
  starts_at timestamptz,
  location text,
  capacity integer default 0,
  budget_planned numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- Inscritos
create table attendees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  company text,
  ticket text,
  status attendee_status not null default 'pendente',
  created_at timestamptz default now()
);

-- Checklist
create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  task_group text,
  status task_status not null default 'aberta',
  assignee_id uuid references profiles(id),
  due_date date,
  created_at timestamptz default now()
);

-- Categorias de orçamento (por workspace)
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  icon text
);

-- Financeiro
create table transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid references budget_categories(id),
  kind tx_kind not null,
  description text,
  amount numeric(12,2) not null,
  payment_status tx_payment,
  invoice_url text,            -- NF em Supabase Storage
  occurred_on date default now(),
  created_at timestamptz default now()
);

-- Assinatura (espelho do Stripe)
create table subscriptions (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,                   -- 'founder' | 'pro_monthly' | 'pro_annual' | 'trial'
  status text,                 -- 'active' | 'past_due' | 'canceled' ...
  current_period_end timestamptz
);

-- Índices recomendados (docs/05)
create index idx_events_workspace on events (workspace_id);
create index idx_attendees_workspace on attendees (workspace_id);
create index idx_attendees_event_status on attendees (event_id, status);
create index idx_tasks_workspace on tasks (workspace_id);
create index idx_tasks_event on tasks (event_id);
create index idx_tx_workspace on transactions (workspace_id);
create index idx_tx_event_date on transactions (event_id, occurred_on);
create index idx_categories_workspace on budget_categories (workspace_id);
create index idx_memberships_user on memberships (user_id);

-- =============================================================
-- Row-Level Security: um usuário só acessa linhas de workspaces
-- aos quais pertence (via memberships). Papéis refinam na aplicação.
-- =============================================================

create or replace function auth_workspace_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select workspace_id from memberships where user_id = auth.uid()
$$;

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table memberships enable row level security;
alter table events enable row level security;
alter table attendees enable row level security;
alter table tasks enable row level security;
alter table transactions enable row level security;
alter table budget_categories enable row level security;
alter table subscriptions enable row level security;

-- Perfil: cada usuário lê/edita o próprio
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces: membros leem; owner escreve
create policy "read member workspaces" on workspaces
  for select using (id in (select auth_workspace_ids()));
create policy "owner writes workspace" on workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Memberships: membros do workspace leem; o próprio vínculo é visível
create policy "read workspace memberships" on memberships
  for select using (workspace_id in (select auth_workspace_ids()) or user_id = auth.uid());
create policy "manage own membership rows" on memberships
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- Padrão por tabela de domínio (events, attendees, tasks, transactions,
-- budget_categories, subscriptions)
create policy "read own workspace events" on events
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write own workspace events" on events
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read own workspace attendees" on attendees
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write own workspace attendees" on attendees
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read own workspace tasks" on tasks
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write own workspace tasks" on tasks
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read own workspace transactions" on transactions
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write own workspace transactions" on transactions
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read own workspace categories" on budget_categories
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write own workspace categories" on budget_categories
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read own workspace subscription" on subscriptions
  for select using (workspace_id in (select auth_workspace_ids()));
-- escrita em subscriptions só via service role (webhook Stripe) — sem policy de write.
