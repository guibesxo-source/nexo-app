-- =============================================================
-- Nexo · Migration 0003 — inscritos ao vivo (Supabase Realtime)
-- Habilita o Realtime na tabela `attendees` (e `ingest_endpoints`) para que a UI
-- receba cada inscrição na HORA, sem depender de polling. Com isso, o dashboard
-- e a tela de Inscritos atualizam sozinhos quando alguém se inscreve na LP.
--
-- A RLS continua valendo: via Realtime, o cliente só recebe linhas dos
-- workspaces a que pertence (mesma policy de SELECT já existente).
--
-- OPCIONAL: sem esta migration o app ainda atualiza sozinho, via polling
-- (useLiveAttendees no AppShell). Aplicá-la só torna a atualização instantânea.
--
-- Aplicar: supabase db push (ou colar no SQL editor do dashboard).
-- =============================================================

-- Idempotente: só adiciona à publication se ainda não estiver lá.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendees'
  ) then
    alter publication supabase_realtime add table public.attendees;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ingest_endpoints'
  ) then
    alter publication supabase_realtime add table public.ingest_endpoints;
  end if;
end $$;
