-- =============================================================
-- Nexo · Migration 0006 — billing agnóstico de provedor (Abacate Pay)
--
-- A tabela `subscriptions` da 0001 nasceu modelada pro Stripe e nunca foi ligada
-- a nada. O Nexo vai cobrar pela ABACATE PAY (PIX por período + assinatura no
-- cartão), então esta migration troca as colunas `stripe_*` por colunas neutras
-- de provedor e define o vocabulário de plano/status que o app usa:
--
--   plan   : 'trial' | 'founder'
--   status : 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
--   kind   : 'pix_period' (PIX, libera 365d, renovação manual)
--            'card_subscription' (cartão, auto-renova via Assinatura da Abacate)
--   method : 'pix' | 'card'
--
-- A RLS continua: o workspace LÊ a própria assinatura; ESCRITA só por service
-- role (o webhook /api/billing/webhook fura a RLS de propósito — é a Abacate
-- confirmando o pagamento, sem sessão de usuário).
--
-- Aplicar: cole no SQL editor do dashboard do Supabase e rode (ou supabase db
-- push). Idempotente.
-- =============================================================

-- 1) Remove as colunas específicas do Stripe (nunca usadas).
alter table public.subscriptions drop column if exists stripe_customer_id;
alter table public.subscriptions drop column if exists stripe_subscription_id;

-- 2) Colunas neutras de provedor.
alter table public.subscriptions add column if not exists provider text not null default 'abacate';
alter table public.subscriptions add column if not exists provider_customer_id text;
alter table public.subscriptions add column if not exists provider_billing_id text;       -- última cobrança PIX
alter table public.subscriptions add column if not exists provider_subscription_id text;   -- assinatura no cartão
alter table public.subscriptions add column if not exists method text;                      -- 'pix' | 'card'
alter table public.subscriptions add column if not exists kind text;                        -- 'pix_period' | 'card_subscription'
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

-- 3) A RLS de leitura já existe na 0001 ("read own workspace subscription").
--    Escrita segue sem policy = só service role. Nada a fazer aqui além de
--    garantir que o RLS está ligado (idempotente).
alter table public.subscriptions enable row level security;
