// Conversão entre as linhas do Postgres (snake_case, com workspace_id) e os
// tipos de domínio que a UI usa (types/index.ts). A hidratação chama os
// rowTo*; o write-through chama os *ToRow para montar os payloads de insert.
// Mantém a UI alheia ao banco: ela só vê os tipos de @/types.

import type {
  Activity,
  Attendee,
  BudgetCategory,
  ChecklistTemplate,
  ChecklistTemplateItem,
  Event,
  Member,
  Task,
  TaskAttachment,
  Transaction,
} from "@/types";

// Linhas cruas vindas do supabase-js (tipagem frouxa — o PostgREST devolve
// numeric como number|string e jsonb já desserializado).
type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

function leadFields(v: unknown): Attendee["lead_fields"] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      key: str(item.key),
      label: str(item.label),
      value: str(item.value),
      source: (item.source as NonNullable<Attendee["lead_fields"]>[number]["source"]) ?? null,
      group: (item.group as NonNullable<Attendee["lead_fields"]>[number]["group"]) ?? null,
    }))
    .filter((item) => item.key && item.label && item.value);
}

/* ---------- Members ---------- */

export function rowToMember(r: Row): Member {
  return {
    id: str(r.id),
    name: str(r.name),
    email: str(r.email),
    initials: str(r.initials),
    role: (r.role as Member["role"]) ?? "member",
    title: str(r.title),
    avatar: (r.avatar as string | null) ?? null,
    created_at: str(r.created_at),
  };
}

export function memberToRow(workspaceId: string, m: Member, profileId?: string | null): Row {
  return {
    id: m.id,
    workspace_id: workspaceId,
    profile_id: profileId ?? null,
    name: m.name,
    email: m.email || null,
    initials: m.initials || null,
    role: m.role,
    title: m.title || null,
    avatar: m.avatar ?? null,
    created_at: m.created_at,
  };
}

/* ---------- Events ---------- */

export function rowToEvent(r: Row): Event {
  return {
    id: str(r.id),
    name: str(r.name),
    status: r.status as Event["status"],
    starts_at: str(r.starts_at),
    location: str(r.location),
    capacity: num(r.capacity),
    budget_planned: num(r.budget_planned),
    cover: str(r.cover),
    format: (r.format as Event["format"]) ?? undefined,
    priority: (r.priority as Event["priority"]) ?? undefined,
    created_at: str(r.created_at),
  };
}

export function eventToRow(workspaceId: string, e: Event): Row {
  return {
    id: e.id,
    workspace_id: workspaceId,
    name: e.name,
    status: e.status,
    starts_at: e.starts_at || null,
    location: e.location || null,
    capacity: e.capacity ?? 0,
    budget_planned: e.budget_planned ?? 0,
    cover: e.cover || null,
    format: e.format ?? null,
    priority: e.priority ?? null,
    created_at: e.created_at,
  };
}

/* ---------- Attendees ---------- */

export function rowToAttendee(r: Row): Attendee {
  return {
    id: str(r.id),
    event_id: str(r.event_id),
    name: str(r.name),
    email: str(r.email),
    company: str(r.company),
    ticket: r.ticket as Attendee["ticket"],
    status: r.status as Attendee["status"],
    external_source: (r.external_source as Attendee["external_source"]) ?? null,
    external_id: strOrNull(r.external_id),
    lead_fields: leadFields(r.lead_fields),
    created_at: str(r.created_at),
  };
}

export function attendeeToRow(workspaceId: string, a: Attendee): Row {
  return {
    id: a.id,
    workspace_id: workspaceId,
    event_id: a.event_id,
    name: a.name,
    email: a.email || null,
    company: a.company || null,
    ticket: a.ticket,
    status: a.status,
    external_source: a.external_source ?? null,
    external_id: a.external_id ?? null,
    created_at: a.created_at,
  };
}

/* ---------- Tasks (+ anexos) ---------- */

/** Monta a Task da UI a partir da linha + os anexos já agrupados por task_id. */
export function rowToTask(r: Row, attachments: TaskAttachment[] = []): Task {
  return {
    id: str(r.id),
    event_id: str(r.event_id),
    title: str(r.title),
    group: str(r.task_group),
    phase: (r.phase as Task["phase"]) ?? undefined,
    status: r.status as Task["status"],
    assignee_id: strOrNull(r.assignee_id),
    due_date: strOrNull(r.due_date),
    description: (r.description as string | undefined) ?? undefined,
    attachments: attachments.length ? attachments : undefined,
    cost_estimate: r.cost_estimate == null ? undefined : num(r.cost_estimate),
    finance_tx_id: strOrNull(r.finance_tx_id),
    created_at: str(r.created_at),
  };
}

/** Linha de tasks (sem os anexos — esses vivem em task_attachments). */
export function taskToRow(workspaceId: string, t: Task): Row {
  return {
    id: t.id,
    workspace_id: workspaceId,
    event_id: t.event_id,
    title: t.title,
    task_group: t.group || null,
    phase: t.phase ?? null,
    status: t.status,
    assignee_id: t.assignee_id ?? null,
    due_date: t.due_date ?? null,
    description: t.description ?? null,
    cost_estimate: t.cost_estimate ?? null,
    finance_tx_id: t.finance_tx_id ?? null,
    created_at: t.created_at,
  };
}

export function rowToAttachment(r: Row): TaskAttachment {
  return {
    id: str(r.id),
    name: str(r.name),
    kind: (r.kind as TaskAttachment["kind"]) ?? "file",
    data: str(r.data),
    added_at: str(r.added_at),
  };
}

export function attachmentToRow(
  workspaceId: string,
  taskId: string,
  a: TaskAttachment
): Row {
  return {
    id: a.id,
    workspace_id: workspaceId,
    task_id: taskId,
    name: a.name,
    kind: a.kind,
    data: a.data,
    added_at: a.added_at,
  };
}

/* ---------- Categorias ---------- */

export function rowToCategory(r: Row): BudgetCategory {
  return { id: str(r.id), name: str(r.name), icon: str(r.icon) };
}

export function categoryToRow(workspaceId: string, c: BudgetCategory): Row {
  return { id: c.id, workspace_id: workspaceId, name: c.name, icon: c.icon || null };
}

/* ---------- Transações ---------- */

export function rowToTransaction(r: Row): Transaction {
  return {
    id: str(r.id),
    event_id: str(r.event_id),
    category_id: strOrNull(r.category_id),
    kind: r.kind as Transaction["kind"],
    description: str(r.description),
    amount: num(r.amount),
    payment_status: r.payment_status as Transaction["payment_status"],
    invoice_ref: strOrNull(r.invoice_ref),
    invoice_file: (r.invoice_file as Transaction["invoice_file"]) ?? null,
    boleto_file: (r.boleto_file as Transaction["boleto_file"]) ?? null,
    occurred_on: str(r.occurred_on),
    created_at: str(r.created_at),
  };
}

export function transactionToRow(workspaceId: string, t: Transaction): Row {
  return {
    id: t.id,
    workspace_id: workspaceId,
    event_id: t.event_id,
    category_id: t.category_id ?? null,
    kind: t.kind,
    description: t.description || null,
    amount: t.amount,
    payment_status: t.payment_status ?? null,
    invoice_ref: t.invoice_ref ?? null,
    invoice_file: t.invoice_file ?? null,
    boleto_file: t.boleto_file ?? null,
    occurred_on: t.occurred_on || null,
    created_at: t.created_at,
  };
}

/* ---------- Atividade ---------- */

export function rowToActivity(r: Row): Activity {
  return {
    id: str(r.id),
    icon: str(r.icon),
    text: Array.isArray(r.text) ? (r.text as string[]) : [],
    created_at: str(r.created_at),
  };
}

export function activityToRow(workspaceId: string, a: Activity): Row {
  return {
    id: a.id,
    workspace_id: workspaceId,
    icon: a.icon,
    text: a.text,
    created_at: a.created_at,
  };
}

/* ---------- Templates de checklist (customizados) ---------- */

export function rowToTemplate(r: Row): ChecklistTemplate {
  return {
    id: str(r.id),
    name: str(r.name),
    format: (r.format as ChecklistTemplate["format"]) ?? undefined,
    builtin: false,
    items: Array.isArray(r.items) ? (r.items as ChecklistTemplateItem[]) : [],
  };
}

export function templateToRow(workspaceId: string, t: ChecklistTemplate): Row {
  return {
    id: t.id,
    workspace_id: workspaceId,
    name: t.name,
    format: t.format ?? null,
    items: t.items,
  };
}
