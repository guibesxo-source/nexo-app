import type { AttendeeDraft } from "@/lib/db/actions";
import { attendeeSchema } from "@/lib/validations/attendee";
import type { LeadField } from "@/types";

// Converte os campos de uma submissão de formulário do HubSpot (lidos na LP e
// enviados ao webhook, ou de um CSV exportado) num inscrito do Nexo. Filosofia:
// CAPTURAR TUDO que ajuda no CRM e jogar fora SÓ o ruído técnico.
//   • Núcleo (nome, e-mail, empresa) vira coluna do inscrito.
//   • Os campos que importam (telefone, cargo, tamanho da frota), UTMs e clicks
//     de anúncio ganham rótulo limpo e ordem fixa.
//   • TODO o resto do formulário é mantido como dado de lead (rótulo humanizado).
//   • Lixo do HubSpot (hs_context, hutk, recaptcha, consentimentos, blobs JSON)
//     é descartado.
// A UI deixa o usuário escolher quais campos aparecem (Filtros + painel do lead).
// Importa só TIPOS de @/lib/db (erasados em build) — roda no route handler.

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

/** Rótulo legível a partir da chave: "ultima_fonte_conversao" → "Ultima Fonte Conversao". */
function humanize(key: string): string {
  return key
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Campos internos/ruído do HubSpot que NUNCA viram dado do lead. */
const JUNK_KEY =
  /^(hs_|__hs|hutk$|hssc$|hstc$|g_recaptcha|recaptcha|captcha|legalconsent|communication|cookie|csrf|ip_)/;

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
  company: ["nome_da_empresa", "nome_empresa", "empresa_nome", "mkt_empresa", "mkt_company", "sua_empresa", "empresa", "razao_social", "company", "company_name", "your_company", "organizacao", "organization"],
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

/** Primeiro sinônimo presente; marca a chave como consumida (não vira genérico). */
function pick(map: Map<string, string>, keys: readonly string[], consumed: Set<string>): string {
  for (const k of keys) {
    const v = map.get(k);
    if (v) {
      consumed.add(k);
      return v;
    }
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

/** Provedores de e-mail pessoais — não viram nome de empresa. */
const FREE_EMAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "live.com", "msn.com", "yahoo.com", "yahoo.com.br", "yahoo.es", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "zoho.com",
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "globo.com", "globomail.com", "r7.com",
]);

/** Empresa a partir do domínio do e-mail corporativo (joao@prologapp.com → "Prologapp"). */
function companyFromEmail(email: string): string {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (!domain || FREE_EMAIL.has(domain)) return "";
  const core = domain.split(".")[0];
  if (!core || core.length < 2) return "";
  return core.charAt(0).toUpperCase() + core.slice(1);
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

  const consumed = new Set<string>();

  // 2) E-mail (obrigatório) — sinônimo direto, depois qualquer "*email*", por fim
  //    qualquer valor com cara de e-mail. A chave usada é marcada como consumida.
  let email = pick(map, SYN.email, consumed);
  if (!EMAIL_RE.test(email)) {
    for (const [k, v] of map)
      if (!consumed.has(k) && k.includes("email") && EMAIL_RE.test(v)) { email = v; consumed.add(k); break; }
  }
  if (!EMAIL_RE.test(email)) {
    for (const [k, v] of map)
      if (!consumed.has(k) && EMAIL_RE.test(v)) { email = v; consumed.add(k); break; }
  }

  // 3) Nome — firstname+lastname, depois nome completo, por fim a partir do email.
  const first = pick(map, SYN.firstname, consumed);
  const last = pick(map, SYN.lastname, consumed);
  let name = clean([first, last].filter(Boolean).join(" "));
  if (!name) name = pick(map, SYN.fullname, consumed);
  if (!name && EMAIL_RE.test(email)) name = nameFromEmail(email);

  // Empresa: campo do formulário; se não houver, deduz do domínio corporativo.
  let company = pick(map, SYN.company, consumed);
  if (!company && EMAIL_RE.test(email)) company = companyFromEmail(email);

  // 4) Validação: sem email/nome usável, a submissão não vira inscrito.
  const parsed = attendeeSchema.safeParse({
    name,
    email,
    company,
    ticket: "Inscrição", // origem é formulário/LP, não ingresso
    status: "pendente",
  });
  if (!parsed.success) return { ok: false, reason: "invalid" };

  // 5) Dados do lead: importantes primeiro (rótulo limpo), depois TODO o resto.
  const lead_fields: LeadField[] = [];
  const push = (key: string, label: string, value: string, group: LeadField["group"] = "lead") => {
    if (value) lead_fields.push({ key: `hubspot:${key}`, label, value, source: "hubspot", group });
  };

  // 5a) Reconhecidos (ordem fixa).
  push("telefone", "Telefone", asPhone(pick(map, SYN.phone, consumed)));
  push("cargo", "Cargo", pick(map, SYN.cargo, consumed));
  push("tamanho_frota", "Tamanho da frota", pick(map, SYN.fleet, consumed));

  // 5b) Origem do lead: UTMs + clicks de anúncio (atribuição p/ CRM).
  for (const u of UTM_ORDER) {
    const v = map.get(u);
    if (v) { consumed.add(u); push(u, UTM_LABELS[u], v); }
  }
  const gclid = map.get("gclid");
  if (gclid) { consumed.add("gclid"); push("gclid", "Google Click ID", gclid); }
  const fbclid = map.get("fbclid");
  if (fbclid) { consumed.add("fbclid"); push("fbclid", "Facebook Click ID", fbclid); }
  if (ctx.pageUrl) { consumed.add("page_url"); push("page_url", "Página de origem", clean(ctx.pageUrl)); }

  // 5c) Tudo o mais que o formulário trouxe (não-lixo) — captura para CRM.
  for (const [k, v] of map) {
    if (consumed.has(k)) continue;
    push(k, humanize(k), v, "custom");
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
