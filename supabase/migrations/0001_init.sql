-- =============================================================
-- Nexo · Migration inicial — schema base multi-tenant com RLS
-- Fonte: docs/05-modelo-de-dados.md (repo do protótipo) + os tipos de
-- domínio reais que a UI da F2 usa (types/index.ts). A camada @/lib/db
-- hidrata o estado a partir destas tabelas e grava write-through.
-- Aplicar quando o projeto Supabase nascer:
--   supabase db push   (ou colar no SQL editor do dashboard)
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
  title text,
  created_at timestamptz default now()
);

-- Workspace (tenant)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text default '(GMT-3) São Paulo',
  owner_id uuid not null references profiles(id),
  created_at timestamptz default now()
);

-- Controle de acesso: quem pode entrar no workspace (alimenta a RLS).
create table memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz default now(),
  unique (workspace_id, user_id)
);

-- Roster do time exibido na UI. Nem todo membro tem login (profile_id null);
-- o usuário logado é o member com profile_id preenchido. assignee de tarefas.
create table members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  email text,
  initials text,
  role membership_role not null default 'member',
  title text,
  avatar text,                 -- foto de perfil (data URL hoje; path do Storage depois)
  created_at timestamptz default now()
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
  cover text,                  -- gradiente CSS do card
  format text,                 -- 'online' | 'presencial' | 'hibrido'
  priority text,               -- 'alta' | 'media' | 'baixa'
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
  ticket text,                 -- 'Geral' | 'Pro' | 'VIP'
  status attendee_status not null default 'pendente',
  external_source text,        -- 'sympla' | 'hubspot' | 'csv' | null
  external_id text,            -- id estável na origem externa
  created_at timestamptz default now()
);

-- Checklist
create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  task_group text,             -- "group" na UI (ex.: "Pré-produção")
  phase text,                  -- 'pre' | 'durante' | 'pos' (ausente = derivada do prazo)
  status task_status not null default 'aberta',
  assignee_id uuid references members(id) on delete set null,
  due_date date,
  description text,
  cost_estimate numeric(12,2),
  finance_tx_id uuid,          -- transação ligada quando o custo foi lançado
  created_at timestamptz default now()
);

-- Anexos de tarefa (imagem/arquivo). "data" = data URL hoje; path do Storage depois.
create table task_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  name text not null,
  kind text,                   -- 'image' | 'file'
  data text,
  added_at timestamptz default now()
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
  category_id uuid references budget_categories(id) on delete set null,
  kind tx_kind not null,
  description text,
  amount numeric(12,2) not null,
  payment_status tx_payment,
  invoice_ref text,            -- rótulo da NF (ex.: "NF #2241")
  invoice_file jsonb,          -- { name, data } — data URL hoje; { name, path } no Storage depois
  boleto_file jsonb,           -- idem
  occurred_on date default now(),
  created_at timestamptz default now()
);

-- Configurações/preferências do workspace (toggles, tokens, dashboard, etc.)
create table app_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

-- Feed de atividade
create table activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  icon text,
  text jsonb,                  -- string[] (segmentos texto normal/negrito)
  created_at timestamptz default now()
);

-- Templates de checklist customizados (built-ins vivem em código)
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  format text,
  items jsonb not null default '[]'::jsonb,
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
create index idx_members_workspace on members (workspace_id);
create index idx_events_workspace on events (workspace_id);
create index idx_attendees_workspace on attendees (workspace_id);
create index idx_attendees_event_status on attendees (event_id, status);
create index idx_tasks_workspace on tasks (workspace_id);
create index idx_tasks_event on tasks (event_id);
create index idx_task_attachments_task on task_attachments (task_id);
create index idx_tx_workspace on transactions (workspace_id);
create index idx_tx_event_date on transactions (event_id, occurred_on);
create index idx_categories_workspace on budget_categories (workspace_id);
create index idx_activity_workspace on activity (workspace_id, created_at desc);
create index idx_templates_workspace on checklist_templates (workspace_id);
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
alter table members enable row level security;
alter table events enable row level security;
alter table attendees enable row level security;
alter table tasks enable row level security;
alter table task_attachments enable row level security;
alter table transactions enable row level security;
alter table budget_categories enable row level security;
alter table app_settings enable row level security;
alter table activity enable row level security;
alter table checklist_templates enable row level security;
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

-- Padrão por tabela de domínio: ler/escrever só linhas do próprio workspace.
create policy "read members" on members
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write members" on members
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

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

create policy "read task attachments" on task_attachments
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write task attachments" on task_attachments
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

create policy "read app settings" on app_settings
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write app settings" on app_settings
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read activity" on activity
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write activity" on activity
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read checklist templates" on checklist_templates
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "write checklist templates" on checklist_templates
  for all using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "read own workspace subscription" on subscriptions
  for select using (workspace_id in (select auth_workspace_ids()));
-- escrita em subscriptions só via service role (webhook Stripe) — sem policy de write.
