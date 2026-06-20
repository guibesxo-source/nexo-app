import type { AttendeeDraft } from "@/lib/db/actions";
import { attendeeSchema } from "@/lib/validations/attendee";
import type { LeadField } from "@/types";

// Converte os campos de uma submissão de formulário do HubSpot (lidos na LP e
// enviados ao webhook, ou de um CSV exportado) num inscrito do Nexo JÁ VALIDADO
// e LIMPO. Reconhece os campos que importam — nome, email, telefone, empresa,
// cargo, tamanho da frota — por sinônimos PT/EN; mantém só as UTMs + página de
// origem como extras; e DESCARTA o lixo do HubSpot (hs_context, hutk, tokens de
// recaptcha, blobs JSON, consentimentos...). Importa só TIPOS de @/lib/db.

type Field = { name: string; value: string };

/** name do input → chave canônica: minúsculo, sem acento, separadores → "_".
   Remove o prefixo de objeto que o HubSpot às vezes injeta (ex.: "0-1/email"). */
function canon(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^\d+[-_/]\d+[-_/]/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

/** Campos internos/ruído do HubSpot que NUNCA viram dado do lead. */
const JUNK_KEY =
  /^(hs_|__hs|hutk$|hssc$|hstc$|g_recaptcha|recaptcha|captcha|legalconsent|communication|cookie|csrf|ip_|gclid$|fbclid$)/;

function isJunk(key: string, value: string): boolean {
  if (!key || JUNK_KEY.test(key)) return true;
  const v = value.trim();
  if (!v) return true;
  if (v.length > 500) return true; // blob
  if (/^[{[]/.test(v) && v.length > 80) return true; // JSON serializado (hs_context etc.)
  return false;
}

// Sinônimos (chave canônica) dos campos que importam — PT e EN, incluindo os
// prefixos "mkt_" das propriedades de marketing do HubSpot.
const SYN = {
  email: ["email", "mkt_email", "e_mail", "seu_email", "your_email", "email_address"],
  firstname: ["firstname", "first_name", "primeiro_nome"],
  lastname: ["lastname", "last_name", "sobrenome", "ultimo_nome"],
  fullname: ["mkt_nome_completo", "nome_completo", "fullname", "full_name", "nome", "name", "seu_nome", "participante"],
  phone: ["mkt_telefone", "telefone", "telefone_celular", "phone", "celular", "whatsapp", "mobilephone", "mobile_phone", "fone", "tel"],
  company: ["nome_da_empresa", "mkt_empresa", "empresa", "company", "company_name", "organizacao", "organization"],
  cargo: ["cargo", "mkt_cargo", "jobtitle", "job_title", "funcao", "position", "role"],
  fleet: ["qual_o_tamanho_da_sua_frota", "qual_o_tamanho_da_frota", "tamanho_da_sua_frota", "tamanho_da_frota", "tamanho_frota", "mkt_frota", "frota", "fleet_size", "fleet"],
} as const;

const UTM_LABELS: Record<string, string> = {
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  utm_term: "UTM Term",
  utm_content: "UTM Content",
  utm_id: "UTM ID",
};
const UTM_ORDER = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function firstOf(map: Map<string, string>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = map.get(k);
    if (v) return v;
  }
  return "";
}

/** "guilherme.cerutti" → "Guilherme Cerutti" (nome decente a partir do email). */
function nameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Telefone só vale se tiver pelo menos 8 dígitos; senão não é telefone. */
function asPhone(v: string): string {
  return v.replace(/\D/g, "").length >= 8 ? clean(v) : "";
}

export type HubspotFormContext = { submittedAt?: string; pageUrl?: string };

export type HubspotFormResult =
  | { ok: true; draft: AttendeeDraft }
  | { ok: false; reason: "invalid" };

/** Campos do formulário → AttendeeDraft validado. Inválido se faltar email/nome. */
export function hubspotFormToDraft(
  fields: Field[],
  ctx: HubspotFormContext = {}
): HubspotFormResult {
  // 1) Limpa e descarta o lixo já na entrada.
  const map = new Map<string, string>();
  for (const f of fields) {
    const key = canon(f.name);
    const value = clean(f.value ?? "");
    if (key && value && !isJunk(key, value) && !map.has(key)) map.set(key, value);
  }

  // 2) E-mail (obrigatório) — sinônimo direto, depois qualquer campo "*email*",
  //    por fim qualquer valor com cara de e-mail.
  let email = firstOf(map, SYN.email);
  if (!EMAIL_RE.test(email)) {
    for (const [k, v] of map) if (k.includes("email") && EMAIL_RE.test(v)) { email = v; break; }
  }
  if (!EMAIL_RE.test(email)) {
    for (const v of map.values()) if (EMAIL_RE.test(v)) { email = v; break; }
  }

  // 3) Nome — firstname+lastname, depois nome completo, por fim a partir do email.
  const first = firstOf(map, SYN.firstname);
  const last = firstOf(map, SYN.lastname);
  let name = clean([first, last].filter(Boolean).join(" "));
  if (!name) name = firstOf(map, SYN.fullname);
  if (!name && EMAIL_RE.test(email)) name = nameFromEmail(email);

  const company = firstOf(map, SYN.company);

  // 4) Validação: sem email/nome usável, a submissão não vira inscrito.
  const parsed = attendeeSchema.safeParse({
    name,
    email,
    company,
    ticket: "Inscrição", // origem é formulário/LP, não ingresso
    status: "pendente",
  });
  if (!parsed.success) return { ok: false, reason: "invalid" };

  // 5) Dados do lead: SÓ o que importa, em ordem fixa e com rótulo limpo.
  const lead_fields: LeadField[] = [];
  const add = (key: string, label: string, value: string) => {
    if (value) lead_fields.push({ key: `hubspot:${key}`, label, value, source: "hubspot", group: "lead" });
  };

  add("telefone", "Telefone", asPhone(firstOf(map, SYN.phone)));
  add("cargo", "Cargo", firstOf(map, SYN.cargo));
  add("tamanho_frota", "Tamanho da frota", firstOf(map, SYN.fleet));
  for (const u of UTM_ORDER) add(u, UTM_LABELS[u], map.get(u) ?? "");
  if (ctx.pageUrl) add("page_url", "Página de origem", clean(ctx.pageUrl));

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
