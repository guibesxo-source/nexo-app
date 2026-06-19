import type { AttendeeDraft } from "@/lib/db/actions";
import { attendeeSchema } from "@/lib/validations/attendee";
import type { LeadField } from "@/types";

// Converte os campos de uma submissão de formulário do HubSpot (lidos na LP e
// enviados ao webhook) num inscrito do Nexo. Mesma ideia do mapper do Sympla
// (lib/integrations/sympla.ts), porém enxuto: aqui a origem é um formulário
// embedado, não a API. Importa só TIPOS de @/lib/db (erasados em build) — este
// módulo roda no servidor (route handler), sem puxar a store do client.

type Field = { name: string; value: string };

// Nomes internos de campo do HubSpot que viram colunas do inscrito — não entram
// em lead_fields (já estão no registro principal).
const CORE = new Set(["email", "firstname", "lastname", "fullname", "name", "company"]);

const UTM_LABELS: Record<string, string> = {
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  utm_term: "UTM Term",
  utm_content: "UTM Content",
  utm_id: "UTM ID",
};

const norm = (s: string) => s.toLowerCase().trim();

function humanize(key: string): string {
  return key
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findEmail(map: Map<string, string>): string {
  const direct = map.get("email");
  if (direct) return direct;
  for (const [k, v] of map) if (k.includes("email") && EMAIL_RE.test(v)) return v;
  for (const v of map.values()) if (EMAIL_RE.test(v)) return v; // último recurso
  return "";
}

export type HubspotFormContext = { submittedAt?: string; pageUrl?: string };

export type HubspotFormResult =
  | { ok: true; draft: AttendeeDraft }
  | { ok: false; reason: "invalid" };

/** Campos do formulário → AttendeeDraft. Inválido se faltar email/nome usável. */
export function hubspotFormToDraft(
  fields: Field[],
  ctx: HubspotFormContext = {}
): HubspotFormResult {
  const map = new Map<string, string>();
  for (const f of fields) {
    const key = norm(f.name);
    if (key && f.value && !map.has(key)) map.set(key, f.value);
  }

  const email = findEmail(map);
  const name =
    [map.get("firstname"), map.get("lastname")].filter(Boolean).join(" ") ||
    map.get("fullname") ||
    map.get("name") ||
    (email ? email.split("@")[0] : "");
  const company = map.get("company") ?? "";

  const parsed = attendeeSchema.safeParse({
    name,
    email,
    company,
    ticket: "Inscrição", // origem é formulário/LP, não ingresso
    status: "pendente",
  });
  if (!parsed.success) return { ok: false, reason: "invalid" };

  // Demais campos viram lead_fields (UTM com rótulo bonito; resto humanizado).
  const lead_fields: LeadField[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    const key = norm(f.name);
    if (!key || CORE.has(key) || !f.value) continue;
    const utm = key.match(/^utm[_-]?(source|medium|campaign|term|content|id)$/);
    const normKey = utm ? `utm_${utm[1]}` : key;
    if (seen.has(normKey)) continue;
    seen.add(normKey);
    lead_fields.push({
      key: `hubspot:${normKey}`,
      label: utm ? UTM_LABELS[normKey] : humanize(f.name),
      value: f.value,
      source: "hubspot",
      group: utm ? "lead" : "custom",
    });
  }
  if (ctx.pageUrl && !seen.has("page_url")) {
    lead_fields.push({
      key: "hubspot:page_url",
      label: "Página de origem",
      value: ctx.pageUrl,
      source: "hubspot",
      group: "lead",
    });
  }

  return {
    ok: true,
    draft: {
      ...parsed.data,
      external_source: "hubspot",
      external_id: `hubspot:${email.toLowerCase()}`,
      lead_fields,
      created_at: ctx.submittedAt,
    },
  };
}
