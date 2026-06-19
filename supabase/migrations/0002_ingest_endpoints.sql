-- =============================================================
-- Nexo · Migration 0002 — endpoints de ingestão (webhook sem API)
-- Recebe inscritos de um formulário externo (ex.: HubSpot embedado numa LP
-- HTML) via POST público autenticado por token, SEM usar a API do provedor.
-- O token resolve workspace_id + event_id; a escrita do inscrito acontece
-- server-side com service role (fura a RLS, pois a submissão chega sem
-- usuário logado).
-- Aplicar: supabase db push (ou colar no SQL editor do dashboard).
-- =============================================================

-- Garante a coluna de campos extras do lead na tabela de inscritos. O caminho
-- client ainda guarda esses campos em app_settings; o webhook grava direto aqui
-- (insert atômico, sem corrida no blob de settings). O hydrate já prefere a
-- coluna quando preenchida.
alter table attendees
  add column if not exists lead_fields jsonb not null default '[]'::jsonb;

-- Endpoint de ingestão por evento. O `token` é o segredo da URL pública.
create table if not exists ingest_endpoints (
  token text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  provider text not null default 'hubspot',
  label text,
  allowed_origin text,             -- se preenchido, trava o CORS a essa origem
  created_at timestamptz default now(),
  last_received_at timestamptz,    -- bump pelo service role a cada recebimento
  received_count integer not null default 0
);

create index if not exists idx_ingest_endpoints_workspace on ingest_endpoints (workspace_id);
create index if not exists idx_ingest_endpoints_event on ingest_endpoints (event_id);

alter table ingest_endpoints enable row level security;

-- Membros do workspace leem/criam/apagam seus endpoints pela UI (client anon).
-- As stats (received_count/last_received_at) são escritas só pelo service role
-- no route handler — por isso NÃO há policy de update (como subscriptions).
create policy "read own workspace ingest endpoints" on ingest_endpoints
  for select using (workspace_id in (select auth_workspace_ids()));
create policy "insert own workspace ingest endpoints" on ingest_endpoints
  for insert with check (workspace_id in (select auth_workspace_ids()));
create policy "delete own workspace ingest endpoints" on ingest_endpoints
  for delete using (workspace_id in (select auth_workspace_ids()));
