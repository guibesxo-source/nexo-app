-- =============================================================
-- Nexo · Migration 0005 — dedup de inscritos compatível com origens
-- Corrige o erro 23505 (attendees_event_email_uniq) que estoura na
-- sincronização do Sympla.
--
-- Causa: a trava da 0004 era (event_id, lower(email)) para TODO inscrito. Mas
-- com o Sympla conectado o Nexo traz TUDO que vem de lá — cada ingresso é um
-- inscrito (cada um com seu external_id), e a MESMA pessoa pode ter mais de um
-- ingresso sob o próprio e-mail. Sob a trava global, o 2º ingresso batia em
-- duplicate key, não era gravado, e a contagem "voltava" no próximo refresh.
--
-- Esta migration separa a unicidade por ORIGEM, sem reabrir a corrida do webhook:
--   • Sem external_id (CSV/manual): segue 1 e-mail por evento.
--   • Com external_id: unicidade por (evento, origem, external_id). No HubSpot o
--     external_id é "hubspot:<email>", então continua 1 por e-mail (e a corrida
--     onFormSubmit/onFormSubmitted ainda bate em 23505 e é tratada como dup). No
--     Sympla o external_id é o id do ingresso, então e-mail repetido entre
--     ingressos diferentes passa a conviver — todos os inscritos do Sympla entram.
--
-- Aplicar: cole no SQL editor do dashboard do Supabase e rode (ou supabase db
-- push, se a CLI estiver linkada). Idempotente.
-- =============================================================

-- 1) Remove eventuais duplicatas por chave externa antes de criar a trava nova,
--    mantendo a linha mais "rica" (mais campos de lead), depois a mais antiga.
delete from public.attendees a
using (
  select
    id,
    row_number() over (
      partition by event_id, external_source, external_id
      order by
        jsonb_array_length(coalesce(lead_fields, '[]'::jsonb)) desc,
        created_at asc,
        id asc
    ) as rn
  from public.attendees
  where external_id is not null
) dup
where a.id = dup.id
  and dup.rn > 1;

-- 2) Substitui a trava de e-mail por uma PARCIAL: só vale para inscritos sem
--    origem externa (CSV/manual). Linhas com external_id passam a ser regidas
--    pela trava de chave externa abaixo.
drop index if exists attendees_event_email_uniq;
create unique index if not exists attendees_event_email_uniq
  on public.attendees (event_id, lower(email))
  where email is not null and external_id is null;

-- 3) Trava por chave externa: impede reimportar o mesmo registro de origem
--    (mesmo ingresso do Sympla / mesmo envio do HubSpot), permitindo e-mail
--    repetido entre ingressos distintos do Sympla.
create unique index if not exists attendees_event_external_uniq
  on public.attendees (event_id, external_source, external_id)
  where external_id is not null;
