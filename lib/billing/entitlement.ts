// Regras de acesso ao produto (puro, sem dependência de server/client).
// Usado pelo gate server-side (app/(app)/layout.tsx) e pelo banner de trial no
// shell. Fonte do estado: tabela `subscriptions` (migration 0006).

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";
export type SubscriptionPlan = "trial" | "founder";
export type SubscriptionKind = "pix_period" | "card_subscription";
export type SubscriptionMethod = "pix" | "card";

export type Subscription = {
  workspace_id: string;
  provider: string | null;
  provider_customer_id: string | null;
  provider_billing_id: string | null;
  provider_subscription_id: string | null;
  method: SubscriptionMethod | null;
  kind: SubscriptionKind | null;
  plan: SubscriptionPlan | string | null;
  status: SubscriptionStatus | string | null;
  current_period_end: string | null; // ISO
  updated_at?: string | null;
};

/** Dias do período de teste concedido a cada conta nova. */
export const TRIAL_DAYS = 7;

const MS_DAY = 24 * 60 * 60 * 1000;

function periodEndMs(sub: Subscription): number | null {
  if (!sub.current_period_end) return null;
  const t = new Date(sub.current_period_end).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * O workspace tem acesso liberado?
 * - `active`: liberado enquanto o período não expirou (PIX vence sem renovar →
 *   vira "active com data no passado" e cai aqui; assinatura no cartão rola a
 *   data a cada renovação). Sem data = vitalício liberado.
 * - `trialing`: liberado até o fim do teste.
 * - demais (`past_due`/`canceled`/`expired`/sem assinatura): bloqueado.
 */
export function isEntitled(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  const end = periodEndMs(sub);
  if (sub.status === "active") return end == null || end > Date.now();
  if (sub.status === "trialing") return end != null && end > Date.now();
  return false;
}

/** Dias inteiros restantes do teste (0 se acabou ou não está em trial). */
export function trialDaysLeft(sub: Subscription | null | undefined): number {
  if (!sub || sub.status !== "trialing") return 0;
  const end = periodEndMs(sub);
  if (end == null) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / MS_DAY));
}

/** Está no teste e ainda dentro do prazo? (para mostrar o banner de contagem) */
export function isTrialing(sub: Subscription | null | undefined): boolean {
  return !!sub && sub.status === "trialing" && trialDaysLeft(sub) > 0;
}
