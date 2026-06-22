import "server-only";
import crypto from "node:crypto";

// Cliente da AbacatePay (server-only). API v2.
//   • Checkout one-time (PIX) → POST /v2/checkouts/create
//   • Assinatura no cartão     → POST /v2/subscriptions/create
//   • Webhook                  → assinatura HMAC-SHA256 base64 com a chave
//                                pública FIXA da Abacate + ?webhookSecret na URL.
// O preço vive no PRODUTO (criado no painel da Abacate); o checkout só referencia
// o produto por id. Vinculamos o pagamento ao tenant pelo `externalId` = workspace_id
// (o webhook NÃO devolve `metadata`, então externalId é o elo confiável).

const API_BASE = "https://api.abacatepay.com/v2";

export type AbacateCheckout = { id: string; url: string };

function apiKey(): string {
  const k = process.env.ABACATE_API_KEY;
  if (!k) throw new Error("ABACATE_API_KEY não definida no ambiente.");
  return k;
}

async function postCheckout(path: string, body: unknown): Promise<AbacateCheckout> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // checkout é criado on-demand; nunca cachear
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | { data?: { id?: string; url?: string }; error?: unknown }
    | null;

  if (!res.ok || !json?.data?.url || !json.data.id) {
    const err = json?.error;
    const msg = typeof err === "string" ? err : `AbacatePay respondeu ${res.status}`;
    throw new Error(msg);
  }
  return { id: json.data.id, url: json.data.url };
}

type CheckoutInput = {
  productId: string;
  workspaceId: string;
  completionUrl: string;
  returnUrl: string;
};

/** Checkout one-time só PIX (plano Fundador anual). */
export function createPixCheckout(input: CheckoutInput): Promise<AbacateCheckout> {
  return postCheckout("/checkouts/create", {
    items: [{ id: input.productId, quantity: 1 }],
    methods: ["PIX"],
    externalId: input.workspaceId,
    completionUrl: input.completionUrl,
    returnUrl: input.returnUrl,
    metadata: { workspace_id: input.workspaceId },
  });
}

/** Checkout de assinatura no cartão (produto precisa ter `cycle` ANNUALLY). */
export function createCardSubscription(input: CheckoutInput): Promise<AbacateCheckout> {
  return postCheckout("/subscriptions/create", {
    items: [{ id: input.productId, quantity: 1 }],
    methods: ["CARD"],
    externalId: input.workspaceId,
    completionUrl: input.completionUrl,
    returnUrl: input.returnUrl,
    metadata: { workspace_id: input.workspaceId },
  });
}

/**
 * Valida o header X-Webhook-Signature: HMAC-SHA256 (base64) do corpo CRU usando
 * o SEGREDO do webhook (o mesmo configurado no painel da Abacate). Provar essa
 * assinatura = provar conhecimento do segredo (não-forjável). A rota também
 * aceita o segredo via ?webhookSecret= na URL — basta um dos dois bater.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Dias de acesso concedidos por ciclo. ONE_TIME = checkout PIX do Fundador anual.
// Folga de 1–2 dias absorve a latência do webhook sem trancar quem pagou.
const FREQUENCY_DAYS: Record<string, number> = {
  WEEKLY: 8,
  MONTHLY: 31,
  SEMIANNUALLY: 184,
  ANNUALLY: 366,
  ONE_TIME: 365,
};

export type NormalizedWebhook = {
  event: string;
  outcome: "activate" | "cancel" | "ignore";
  workspaceId: string | null; // do externalId (definido por nós no checkout)
  checkoutId: string | null; // data.checkout.id
  subscriptionId: string | null; // data.subscription.id (auto-renovação no cartão)
  customerId: string | null;
  method: "pix" | "card" | null;
  kind: "pix_period" | "card_subscription" | null;
  periodDays: number;
};

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Traduz o payload v2 da Abacate num formato neutro que a rota grava no banco. */
export function normalizeWebhook(payload: unknown): NormalizedWebhook {
  const p = rec(payload);
  const event = str(p.event) ?? "";
  const data = rec(p.data);
  const checkout = rec(data.checkout);
  const subscription = rec(data.subscription);
  const customer = rec(data.customer);
  const payer = rec(data.payerInformation);

  const isSubscription = event.startsWith("subscription.") || !!subscription.id;
  const freq = str(subscription.frequency) ?? str(checkout.frequency) ?? "";

  let outcome: NormalizedWebhook["outcome"] = "ignore";
  if (/\.(completed|renewed)$/.test(event)) outcome = "activate";
  else if (/\.(cancelled|refunded|disputed)$/.test(event)) outcome = "cancel";

  const method =
    str(payer.method)?.toUpperCase() === "CARD" || isSubscription ? "card" : "pix";

  return {
    event,
    outcome,
    workspaceId: str(checkout.externalId) ?? str(subscription.externalId),
    checkoutId: str(checkout.id),
    subscriptionId: str(subscription.id),
    customerId: str(customer.id),
    method: outcome === "ignore" ? null : method,
    kind: isSubscription ? "card_subscription" : "pix_period",
    periodDays: FREQUENCY_DAYS[freq] ?? 365,
  };
}
