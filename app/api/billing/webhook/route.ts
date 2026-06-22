import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { webhookEnvelopeSchema } from "@/lib/validations/abacate";
import { normalizeWebhook, verifyWebhookSignature } from "@/lib/integrations/abacate";

export const runtime = "nodejs";

// Webhook PÚBLICO da AbacatePay — é o gatilho que LIBERA a conta. Dupla camada:
//   1) ?webhookSecret=... na URL (segredo nosso, configurado no painel da Abacate)
//   2) X-Webhook-Signature = HMAC-SHA256 base64 do corpo cru com a chave pública
//      fixa da Abacate (verifyWebhookSignature).
// Grava com service role (fura RLS — não há sessão). Idempotente: o mesmo evento
// reentregue só reescreve o mesmo estado. Responde 200 mesmo no "ignore" pra a
// Abacate não ficar reenviando.

const ok = (status = "ok") => NextResponse.json({ status });

export async function POST(request: Request) {
  // Corpo CRU primeiro (a assinatura HMAC é sobre ele; não pode reparsear).
  const raw = await request.text();
  const secret = process.env.ABACATE_WEBHOOK_SECRET;

  // Autenticação robusta às duas formas que a Abacate pode usar para o segredo:
  //  • ?webhookSecret=... na URL, ou
  //  • X-Webhook-Signature = HMAC-SHA256 do corpo com o mesmo segredo.
  // Basta uma bater — ambas exigem conhecer o segredo (sem furo de chave pública).
  const secretParam = new URL(request.url).searchParams.get("webhookSecret");
  const querySecretOk = !!secret && secretParam === secret;
  const sigOk = verifyWebhookSignature(raw, request.headers.get("x-webhook-signature"), secret);
  if (!querySecretOk && !sigOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(raw || "null");
  const envelope = webhookEnvelopeSchema.safeParse(payload);
  if (!envelope.success) return ok("ignored");

  const ev = normalizeWebhook(payload);
  if (ev.outcome === "ignore") return ok("ignored");

  const admin = createAdminClient();

  // Resolve o workspace: externalId (que definimos no checkout) ou, em
  // renovação/cancelamento sem externalId, pela assinatura/cobrança já gravada.
  let workspaceId = ev.workspaceId;
  if (!workspaceId && ev.subscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("workspace_id")
      .eq("provider_subscription_id", ev.subscriptionId)
      .maybeSingle();
    workspaceId = (data as { workspace_id?: string } | null)?.workspace_id ?? null;
  }
  if (!workspaceId && ev.checkoutId) {
    const { data } = await admin
      .from("subscriptions")
      .select("workspace_id")
      .eq("provider_billing_id", ev.checkoutId)
      .maybeSingle();
    workspaceId = (data as { workspace_id?: string } | null)?.workspace_id ?? null;
  }
  if (!workspaceId) return ok("no-workspace");

  const now = new Date().toISOString();

  if (ev.outcome === "cancel") {
    await admin
      .from("subscriptions")
      .update({ status: "canceled", updated_at: now } as never)
      .eq("workspace_id", workspaceId);
    return ok("canceled");
  }

  // activate: libera o plano Fundador e estende o período de acesso.
  const periodEnd = new Date(Date.now() + ev.periodDays * 24 * 60 * 60 * 1000).toISOString();
  const row: Record<string, unknown> = {
    workspace_id: workspaceId,
    provider: "abacate",
    plan: "founder",
    status: "active",
    method: ev.method,
    kind: ev.kind,
    current_period_end: periodEnd,
    updated_at: now,
  };
  // só sobrescreve ids de provedor quando vieram (não apaga os já gravados).
  if (ev.customerId) row.provider_customer_id = ev.customerId;
  if (ev.checkoutId) row.provider_billing_id = ev.checkoutId;
  if (ev.subscriptionId) row.provider_subscription_id = ev.subscriptionId;

  const { error } = await admin
    .from("subscriptions")
    .upsert(row as never, { onConflict: "workspace_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return ok("activated");
}
