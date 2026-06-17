import { attendeeSchema } from "@/lib/validations/attendee";
import type { AttendeeStatus, LeadField, TicketType } from "@/types";

export type SymplaEvent = {
  id: number | string;
  name?: string;
  start_date?: string;
  published?: number | boolean;
  address?: { city?: string; name?: string } | null;
};

export type SymplaParticipant = {
  id?: number | string;
  event_id?: number | string;
  participant_id?: number | string;
  order_id?: number | string;
  order_status?: string;
  order_date?: string;
  order_updated_date?: string;
  order_approved_date?: string;
  order_discount?: string | number;
  ticket_id?: number | string;
  ticket_number?: number | string;
  ticket_num?: number | string;
  ticket_num_qr_code?: number | string;
  ticket_created_at?: string;
  ticket_updated_at?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  email?: string;
  participant_email?: string;
  buyer_email?: string;
  company?: string;
  organization?: string;
  ticket_name?: string;
  sector_name?: string;
  marked_place_name?: string;
  access_information?: string;
  ticket_sale_price?: number | string;
  status?: string;
  custom_form?: unknown;
  custom_forms?: unknown;
  custom_fields?: unknown;
  form_fields?: unknown;
  answers?: unknown;
  questions?: unknown;
  fields?: unknown;
  created_at?: string;
  updated_at?: string;
  registration_date?: string;
  registered_at?: string;
  order?: {
    id?: number | string;
    status?: string;
    order_date?: string;
    updated_date?: string;
    approved_date?: string;
    buyer?: { email?: string };
  };
  ticket?: {
    id?: number | string;
    number?: number | string;
    name?: string;
  };
  checkin?: { check_in?: boolean | number; check_in_date?: string };
  checked_in?: boolean | number;
};

export type SymplaFieldOption = {
  key: string;
  label: string;
  group: NonNullable<LeadField["group"]>;
  source: "sympla";
  sample?: string;
  count: number;
};

export type SymplaDraftResult = {
  drafts: Array<{
    name: string;
    email: string;
    company: string;
    ticket: TicketType;
    status: AttendeeStatus;
    external_source: "sympla";
    external_id: string;
    lead_fields: LeadField[];
    created_at?: string;
  }>;
  invalid: number;
};

const FIELD_LABELS: Record<string, { label: string; group: NonNullable<LeadField["group"]> }> = {
  id: { label: "ID do ingresso", group: "ticket" },
  participant_id: { label: "ID do participante", group: "ticket" },
  event_id: { label: "ID do evento Sympla", group: "lead" },
  order_id: { label: "ID do pedido", group: "order" },
  order_status: { label: "Status do pedido", group: "order" },
  order_date: { label: "Data do pedido", group: "order" },
  order_updated_date: { label: "Pedido atualizado em", group: "order" },
  order_approved_date: { label: "Pedido aprovado em", group: "order" },
  order_discount: { label: "Desconto do pedido", group: "order" },
  buyer_email: { label: "Email do comprador", group: "lead" },
  ticket_id: { label: "ID do ingresso/ticket", group: "ticket" },
  ticket_number: { label: "Codigo do ingresso", group: "ticket" },
  ticket_num: { label: "Numero do ingresso", group: "ticket" },
  ticket_num_qr_code: { label: "Codigo QR", group: "ticket" },
  ticket_created_at: { label: "Data de inscricao", group: "ticket" },
  ticket_updated_at: { label: "Ingresso atualizado em", group: "ticket" },
  ticket_name: { label: "Nome do ingresso no Sympla", group: "ticket" },
  sector_name: { label: "Setor", group: "ticket" },
  marked_place_name: { label: "Lugar marcado", group: "ticket" },
  access_information: { label: "Informacao de acesso", group: "ticket" },
  ticket_sale_price: { label: "Valor do ingresso", group: "ticket" },
  "order.id": { label: "ID do pedido", group: "order" },
  "order.status": { label: "Status do pedido", group: "order" },
  "order.order_date": { label: "Data do pedido", group: "order" },
  "order.updated_date": { label: "Pedido atualizado em", group: "order" },
  "order.approved_date": { label: "Pedido aprovado em", group: "order" },
  "order.buyer.email": { label: "Email do comprador", group: "lead" },
  "ticket.id": { label: "ID do ticket", group: "ticket" },
  "ticket.number": { label: "Numero do ticket", group: "ticket" },
  "ticket.name": { label: "Nome do ticket", group: "ticket" },
  "checkin.check_in_date": { label: "Data do check-in", group: "ticket" },
};

const CORE_KEYS = new Set([
  "first_name",
  "last_name",
  "full_name",
  "name",
  "email",
  "participant_email",
  "company",
  "organization",
  "status",
  "checked_in",
]);

const CUSTOM_CONTAINERS = [
  "custom_form",
  "custom_forms",
  "custom_fields",
  "form_fields",
  "answers",
  "questions",
  "fields",
];

const REQUIRED_SIGNUP_FIELD_KEYS = new Set([
  "sympla:ticket_created_at",
  "sympla:ticket_created_date",
  "sympla:ticket_date",
  "sympla:registration_date",
  "sympla:registered_at",
  "sympla:created_at",
  "sympla:order_date",
  "sympla:order.order_date",
  "sympla:order_approved_date",
  "sympla:order.approved_date",
]);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const clean = (v: unknown) => (v == null ? "" : String(v).trim());

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function toIsoDateTime(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value < 10000000000 ? value * 1000 : value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const raw = clean(value);
  if (!raw) return undefined;
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw);
    const d = new Date(raw.length === 10 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = br;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const isoLocal = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoLocal;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function leadValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Sim" : "Nao";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(leadValue).filter(Boolean).join(", ");

  const rec = asRecord(v);
  if (!rec) return "";
  const direct = leadValue(rec.value ?? rec.answer ?? rec.response ?? rec.text ?? rec.label ?? rec.name);
  return direct || JSON.stringify(v);
}

function slug(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campo";
}

function humanize(key: string): string {
  return key
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Preserva o nome real do ingresso do Sympla; só cai em "Geral" se vier vazio. */
function mapTicket(v: string): TicketType {
  return v.trim() || "Geral";
}

function mapSymplaStatus(p: SymplaParticipant): AttendeeStatus {
  const tokens = [p.status, p.order_status, p.order?.status].map((v) => norm(clean(v))).filter(Boolean);
  const raw = tokens.join(" ");
  if (tokens.some((v) => v === "c" || v === "r" || v === "na")) return "cancelado";
  if (tokens.some((v) => v === "p" || v === "np")) return "pendente";
  if (raw.includes("cancel") || raw.includes("refund") || raw.includes("reembols")) return "cancelado";
  if (raw.includes("pend") || raw.includes("aguard")) return "pendente";
  if (p.checkin?.check_in || p.checked_in) return "checkin";
  return "confirmado";
}

function externalId(p: SymplaParticipant, symplaEventId: string, index: number, email: string): string {
  const id =
    clean(p.id) ||
    clean(p.participant_id) ||
    clean(p.ticket_id) ||
    clean(p.ticket_number) ||
    clean(p.ticket_num) ||
    clean(p.ticket?.id) ||
    clean(p.ticket?.number);
  if (id) return `${symplaEventId}:${id}`;

  const order = clean(p.order_id ?? p.order?.id);
  const ticket = clean(p.ticket_name ?? p.ticket?.name);
  if (order || ticket || email) return `${symplaEventId}:${order}:${email}:${ticket}:${index}`;

  return `${symplaEventId}:row:${index}`;
}

function rootLeadFields(p: SymplaParticipant): LeadField[] {
  const fields: LeadField[] = [];
  const rec = p as Record<string, unknown>;

  for (const [key, value] of Object.entries(rec)) {
    if (CORE_KEYS.has(key) || CUSTOM_CONTAINERS.includes(key)) continue;
    if (value == null || typeof value === "object") continue;

    const text = leadValue(value);
    if (!text) continue;
    const meta = FIELD_LABELS[key] ?? { label: humanize(key), group: "lead" as const };
    fields.push({
      key: `sympla:${key}`,
      label: meta.label,
      value: text,
      source: "sympla",
      group: meta.group,
    });
  }

  const nested: Array<[string, unknown]> = [
    ["order.id", p.order?.id],
    ["order.status", p.order?.status],
    ["order.order_date", p.order?.order_date],
    ["order.updated_date", p.order?.updated_date],
    ["order.approved_date", p.order?.approved_date],
    ["order.buyer.email", p.order?.buyer?.email],
    ["ticket.id", p.ticket?.id],
    ["ticket.number", p.ticket?.number],
    ["ticket.name", p.ticket?.name],
    ["checkin.check_in_date", p.checkin?.check_in_date],
  ];

  for (const [key, value] of nested) {
    const text = leadValue(value);
    if (!text) continue;
    const meta = FIELD_LABELS[key] ?? { label: humanize(key), group: "lead" as const };
    if (fields.some((field) => field.label === meta.label && field.value === text)) continue;
    fields.push({
      key: `sympla:${key}`,
      label: meta.label,
      value: text,
      source: "sympla",
      group: meta.group,
    });
  }

  return fields;
}

function customLabel(item: Record<string, unknown>, fallback: string): string {
  return clean(
    item.name ??
      item.label ??
      item.question ??
      item.title ??
      item.field ??
      item.field_name ??
      item.key ??
      fallback
  );
}

function customValue(item: Record<string, unknown>): string {
  return leadValue(item.value ?? item.answer ?? item.response ?? item.text ?? item.selected ?? item.options);
}

function pushCustomField(fields: LeadField[], label: string, value: unknown, rawId?: unknown) {
  const cleanLabel = clean(label);
  const cleanValue = leadValue(value);
  if (!cleanLabel || !cleanValue) return;
  const id = clean(rawId);
  fields.push({
    key: `custom:${id ? slug(id) : slug(cleanLabel)}`,
    label: cleanLabel,
    value: cleanValue,
    source: "sympla",
    group: "custom",
  });
}

function extractCustomFields(source: unknown, fallback = "Campo personalizado"): LeadField[] {
  const fields: LeadField[] = [];
  if (!source) return fields;

  if (Array.isArray(source)) {
    source.forEach((item, index) => {
      const rec = asRecord(item);
      if (!rec) return;
      const label = customLabel(rec, `${fallback} ${index + 1}`);
      const value = customValue(rec);
      pushCustomField(fields, label, value, rec.id ?? rec.key ?? rec.name ?? rec.label);
    });
    return fields;
  }

  const rec = asRecord(source);
  if (!rec) return fields;

  const directLabel = customLabel(rec, fallback);
  const directValue = customValue(rec);
  if (directValue && (rec.value !== undefined || rec.answer !== undefined || rec.response !== undefined)) {
    pushCustomField(fields, directLabel, directValue, rec.id ?? rec.key ?? rec.name ?? rec.label);
    return fields;
  }

  for (const [key, value] of Object.entries(rec)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      fields.push(...extractCustomFields(value, humanize(key)));
      continue;
    }

    const child = asRecord(value);
    if (child) {
      const label = customLabel(child, humanize(key));
      const childValue = customValue(child);
      if (childValue) pushCustomField(fields, label, childValue, child.id ?? child.key ?? key);
      continue;
    }

    pushCustomField(fields, humanize(key), value, key);
  }

  return fields;
}

function customLeadFields(p: SymplaParticipant): LeadField[] {
  const fields: LeadField[] = [];
  const rec = p as Record<string, unknown>;
  for (const key of CUSTOM_CONTAINERS) fields.push(...extractCustomFields(rec[key], humanize(key)));

  const seen = new Set<string>();
  return fields.filter((field) => {
    const k = `${field.key}:${field.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function allLeadFields(p: SymplaParticipant): LeadField[] {
  return [...rootLeadFields(p), ...customLeadFields(p)];
}

export function discoverSymplaFields(participants: SymplaParticipant[]): SymplaFieldOption[] {
  const byKey = new Map<string, SymplaFieldOption>();
  for (const participant of participants) {
    for (const field of allLeadFields(participant)) {
      const current = byKey.get(field.key);
      if (current) {
        current.count += 1;
        if (!current.sample) current.sample = field.value;
        continue;
      }
      byKey.set(field.key, {
        key: field.key,
        label: field.label,
        group: field.group ?? "lead",
        source: "sympla",
        sample: field.value,
        count: 1,
      });
    }
  }

  const rank: Record<NonNullable<LeadField["group"]>, number> = {
    order: 1,
    ticket: 2,
    lead: 3,
    custom: 4,
  };

  return [...byKey.values()].sort(
    (a, b) => rank[a.group] - rank[b.group] || a.label.localeCompare(b.label, "pt-BR")
  );
}

export function defaultSymplaFieldKeys(participants: SymplaParticipant[]): string[] {
  return discoverSymplaFields(participants).map((field) => field.key);
}

function selectedLeadFields(p: SymplaParticipant, selectedKeys: string[]): LeadField[] {
  const selected = new Set(selectedKeys);
  const order = new Map(selectedKeys.map((key, index) => [key, index]));
  return allLeadFields(p)
    .filter((field) => selected.has(field.key) || REQUIRED_SIGNUP_FIELD_KEYS.has(field.key))
    .sort(
      (a, b) =>
        (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
        a.label.localeCompare(b.label, "pt-BR")
    );
}

function symplaSignupDate(p: SymplaParticipant): string | undefined {
  const rec = p as Record<string, unknown>;
  return toIsoDateTime(
    p.ticket_created_at ??
      rec.ticket_created_date ??
      rec.ticket_date ??
      p.registration_date ??
      p.registered_at ??
      p.created_at ??
      p.order_date ??
      p.order?.order_date ??
      p.order_approved_date ??
      p.order?.approved_date
  );
}

export function symplaParticipantsToDrafts(
  participants: SymplaParticipant[],
  symplaEventId: string,
  fieldKeys?: string[]
): SymplaDraftResult {
  const drafts: SymplaDraftResult["drafts"] = [];
  let invalid = 0;
  const selectedKeys = fieldKeys ?? defaultSymplaFieldKeys(participants);

  participants.forEach((p, index) => {
    const email = clean(p.email ?? p.participant_email ?? p.buyer_email ?? p.order?.buyer?.email);
    const name =
      clean([p.first_name, p.last_name].filter(Boolean).join(" ")) ||
      clean(p.full_name) ||
      clean(p.name) ||
      (email ? email.split("@")[0] : "");

    const parsed = attendeeSchema.safeParse({
      name,
      email,
      company: clean(p.company ?? p.organization),
      ticket: mapTicket(clean(p.ticket_name ?? p.ticket?.name)),
      status: mapSymplaStatus(p) === "cancelado" ? "cancelado" : "pendente",
    });

    if (!parsed.success) {
      invalid++;
      return;
    }

    drafts.push({
      ...parsed.data,
      external_source: "sympla",
      external_id: externalId(p, symplaEventId, index, email),
      lead_fields: selectedLeadFields(p, selectedKeys),
      created_at: symplaSignupDate(p),
    });
  });

  return { drafts, invalid };
}
