import { attendeeSchema } from "@/lib/validations/attendee";
import type { AttendeeStatus, TicketType } from "@/types";

export type SymplaEvent = {
  id: number | string;
  name?: string;
  start_date?: string;
  published?: number | boolean;
  address?: { city?: string; name?: string } | null;
};

export type SymplaParticipant = {
  id?: number | string;
  participant_id?: number | string;
  ticket_id?: number | string;
  ticket_number?: number | string;
  ticket_num?: number | string;
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
  status?: string;
  order_status?: string;
  ticket?: {
    id?: number | string;
    number?: number | string;
    name?: string;
  };
  order?: {
    id?: number | string;
    status?: string;
    buyer?: { email?: string };
  };
  checkin?: { check_in?: boolean | number };
  checked_in?: boolean | number;
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
  }>;
  invalid: number;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const clean = (v: unknown) => (v == null ? "" : String(v).trim());

function mapTicket(v: string): TicketType {
  const n = norm(v);
  if (n.includes("vip")) return "VIP";
  if (n.includes("pro")) return "Pro";
  return "Geral";
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

  const order = clean(p.order?.id);
  const ticket = clean(p.ticket_name ?? p.ticket?.name);
  if (order || ticket || email) return `${symplaEventId}:${order}:${email}:${ticket}:${index}`;

  return `${symplaEventId}:row:${index}`;
}

export function symplaParticipantsToDrafts(
  participants: SymplaParticipant[],
  symplaEventId: string
): SymplaDraftResult {
  const drafts: SymplaDraftResult["drafts"] = [];
  let invalid = 0;

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
      status: mapSymplaStatus(p),
    });

    if (!parsed.success) {
      invalid++;
      return;
    }

    drafts.push({
      ...parsed.data,
      external_source: "sympla",
      external_id: externalId(p, symplaEventId, index, email),
    });
  });

  return { drafts, invalid };
}
