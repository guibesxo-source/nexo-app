-- =============================================================
-- Nexo · Migration 0004 — dedup de inscritos + trava no banco
-- Corrige (e previne) inscritos duplicados vindos do webhook do formulário.
--
-- Causa: o embed do HubSpot dispara DOIS eventos por envio (onFormSubmit e
-- onFormSubmitted), então o snippet da LP fazia 2 POSTs quase simultâneos. O
-- dedup do route handler era "consulta-depois-insere" (TOCTOU) sem trava no
-- banco — sob a corrida, os dois POSTs passavam pela checagem e ambos gravavam.
--
-- Esta migration: (1) apaga as duplicatas já existentes (todos os eventos),
-- mantendo o melhor registro por (evento, e-mail); (2) cria um índice ÚNICO que
-- torna a duplicata impossível daqui pra frente, mesmo sob corrida. O route
-- handler passa a tratar a violação do índice como "duplicado ignorado".
--
-- Aplicar: supabase db push (ou colar no SQL editor do dashboard).
-- =============================================================

-- 1) Remove duplicatas por (event_id, e-mail case-insensitive). Mantém uma linha
--    por grupo: a mais "rica" (mais campos de lead), depois a mais antiga, com o
--    id como desempate estável. Idempotente — sem duplicatas, não apaga nada.
delete from public.attendees a
using (
  select
    id,
    row_number() over (
      partition by event_id, lower(email)
      order by
        jsonb_array_length(coalesce(lead_fields, '[]'::jsonb)) desc,
        created_at asc,
        id asc
    ) as rn
  from public.attendees
  where email is not null and email <> ''
) dup
where a.id = dup.id
  and dup.rn > 1;

-- 2) Trava definitiva: um e-mail só pode existir uma vez por evento. Parcial
--    (where email is not null) porque inscritos sem e-mail não colidem; o índice
--    casa com o dedup do webhook, que compara o e-mail em minúsculas.
create unique index if not exists attendees_event_email_uniq
  on public.attendees (event_id, lower(email))
  where email is not null;
