import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ingestRequestSchema, normalizeFields } from "@/lib/validations/ingest";
import { hubspotFormToDraft } from "@/lib/integrations/hubspot-form";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Webhook PÚBLICO de ingestão de inscritos a partir de um formulário externo
// (ex.: HubSpot embedado numa LP HTML). A própria LP faz POST aqui no envio do
// formulário — sem usar a API do HubSpot. O `token` (segredo por evento) resolve
// workspace_id + event_id em `ingest_endpoints`; a escrita usa service role
// (fura RLS, pois não há sessão de usuário). Sempre responde 200 quando o token
// é válido — a LP/inscrito não deve ver erro.

type EndpointRow = {
  token: string;
  workspace_id: string;
  event_id: string;
  allowed_origin: string | null;
  received_count: number | null;
};

function cors(origin: string | null, allowed: string | null): Record<string, string> {
  const allow = allowed && allowed.length ? allowed : origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Number/string (epoch s|ms ou ISO) → ISO; undefined se não der pra parsear. */
function toIso(value: string | number): string | undefined {
  const isNumeric = typeof value === "number" || /^\d+$/.test(value);
  if (isNumeric) {
    const n = Number(value);
    const d = new Date(n < 10_000_000_000 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function OPTIONS(request: Request) {
  // Preflight: o token vai no corpo, então liberamos amplo aqui; o POST aplica o
  // allowed_origin específico do endpoint.
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin"), null) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const json = await request.json().catch(() => null);
  const parsed = ingestRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400, headers: cors(origin, null) });
  }

  const admin = createAdminClient();
  const { data: ep, error } = await admin
    .from("ingest_endpoints")
    .select("token, workspace_id, event_id, allowed_origin, received_count")
    .eq("token", parsed.data.token)
    .maybeSingle<EndpointRow>();

  if (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500, headers: cors(origin, null) });
  }
  if (!ep) {
    return NextResponse.json({ error: "Endpoint não encontrado" }, { status: 404, headers: cors(origin, null) });
  }

  const headers = cors(origin, ep.allowed_origin);

  if (ep.allowed_origin && origin && origin !== ep.allowed_origin) {
    return NextResponse.json({ error: "Origem não autorizada" }, { status: 403, headers });
  }

  // Ping de teste do app: token resolvido com sucesso = endpoint no ar. Não grava
  // inscrito nem incrementa contadores (pra não poluir a lista nem as estatísticas).
  if (parsed.data.test) {
    return NextResponse.json({ status: "ok", test: true }, { status: 200, headers });
  }

  const submittedAt = parsed.data.submittedAt != null ? toIso(parsed.data.submittedAt) : undefined;
  const result = hubspotFormToDraft(normalizeFields(parsed.data.fields), {
    submittedAt,
    pageUrl: parsed.data.pageUrl,
  });
  if (!result.ok) {
    // Token válido, mas sem email/nome utilizável → 200 (LP não sinaliza erro).
    return NextResponse.json({ status: "ignored", reason: "sem email válido" }, { status: 200, headers });
  }
  const draft = result.draft;

  // Dedup por email dentro do evento (case-insensitive; escapa curingas do LIKE).
  const likeEmail = draft.email.replace(/([\\%_])/g, "\\$1");
  const { data: existing } = await admin
    .from("attendees")
    .select("id")
    .eq("event_id", ep.event_id)
    .ilike("email", likeEmail)
    .limit(1);

  if (existing && existing.length) {
    return NextResponse.json({ status: "skipped" }, { status: 200, headers });
  }

  const createdAt = draft.created_at ?? new Date().toISOString();
  const { error: insErr } = await admin.from("attendees").insert({
    id: randomUUID(),
    workspace_id: ep.workspace_id,
    event_id: ep.event_id,
    name: draft.name,
    email: draft.email || null,
    company: draft.company || null,
    ticket: draft.ticket,
    status: "pendente",
    external_source: "hubspot",
    external_id: draft.external_id ?? null,
    lead_fields: draft.lead_fields ?? [],
    created_at: createdAt,
  });
  if (insErr) {
    return NextResponse.json({ error: "Falha ao salvar inscrito" }, { status: 500, headers });
  }

  // Best-effort: bump das stats do endpoint + feed de atividade.
  await admin
    .from("ingest_endpoints")
    .update({ received_count: (ep.received_count ?? 0) + 1, last_received_at: new Date().toISOString() })
    .eq("token", ep.token);
  await admin.from("activity").insert({
    id: randomUUID(),
    workspace_id: ep.workspace_id,
    icon: "🎫",
    text: ["", draft.name, " inscrito(a) via formulário"],
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ status: "created" }, { status: 200, headers });
}
