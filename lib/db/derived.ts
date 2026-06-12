// Seletores derivados (puros) — as agregações de dashboard do docs/05 §5,
// calculadas a partir das tabelas-fonte, nunca armazenadas. No Supabase
// virarão views/queries (ex.: event_overview).

import type {
  Attendee,
  AttendeeStatus,
  ChecklistTemplate,
  Event,
  EventPriority,
  EventStatus,
  Task,
  Transaction,
} from "@/types";
import type { DbState } from "./seed";
import { BUILTIN_TEMPLATES } from "./actions";

/* ---------- Metadados de status (tom do Badge + rótulo) ---------- */

export const EVENT_STATUS_META: Record<EventStatus, { tone: string; label: string }> = {
  rascunho: { tone: "gray", label: "Rascunho" },
  planejamento: { tone: "amber", label: "Planejamento" },
  confirmado: { tone: "green", label: "Ativo" },
  encerrado: { tone: "blue", label: "Encerrado" },
  cancelado: { tone: "red", label: "Cancelado" },
};

export const EVENT_PRIORITY_META: Record<EventPriority, { tone: string; label: string }> = {
  alta: { tone: "red", label: "Alta" },
  media: { tone: "amber", label: "Média" },
  baixa: { tone: "gray", label: "Baixa" },
};

/** Prioridade efetiva: eventos criados antes do campo contam como média. */
export const priorityOf = (e: Event): EventPriority => e.priority ?? "media";

export const ATTENDEE_STATUS_META: Record<AttendeeStatus, { tone: string; label: string }> = {
  pendente: { tone: "amber", label: "Pendente" },
  confirmado: { tone: "green", label: "Confirmado" },
  checkin: { tone: "blue", label: "Check-in" },
  cancelado: { tone: "red", label: "Cancelado" },
};

export const PAYMENT_META: Record<string, { tone: string; label: string }> = {
  pago: { tone: "green", label: "Pago" },
  pendente: { tone: "amber", label: "Pendente" },
  recebido: { tone: "green", label: "Recebido" },
};

/* ---------- Lookups básicos ---------- */

export const eventById = (s: DbState, id: string | null): Event | undefined =>
  s.events.find((e) => e.id === id);

export const selectedEvent = (s: DbState): Event | undefined =>
  eventById(s, s.session.selected_event_id) ?? s.events[0];

export const attendeesOf = (s: DbState, eventId: string): Attendee[] =>
  s.attendees.filter((a) => a.event_id === eventId);

export const tasksOf = (s: DbState, eventId: string): Task[] =>
  s.tasks.filter((t) => t.event_id === eventId);

export const txOf = (s: DbState, eventId: string): Transaction[] =>
  s.transactions.filter((t) => t.event_id === eventId);

export const memberById = (s: DbState, id: string | null) =>
  s.members.find((m) => m.id === id);

export const taskById = (s: DbState, id: string | null) =>
  s.tasks.find((t) => t.id === id);

export const txById = (s: DbState, id: string | null) =>
  s.transactions.find((t) => t.id === id);

export const currentUser = (s: DbState) => memberById(s, s.session.user_id);

export const categoryById = (s: DbState, id: string | null) =>
  s.categories.find((c) => c.id === id);

/** Templates disponíveis: built-ins genéricos + os customizados do usuário. */
export const allTemplates = (s: DbState): ChecklistTemplate[] => [
  ...BUILTIN_TEMPLATES,
  ...s.templates,
];

export function isTaskLate(t: Task): boolean {
  if (t.status === "concluida" || !t.due_date) return false;
  const due = new Date(t.due_date + "T23:59:59");
  return due.getTime() < Date.now();
}

/* ---------- KPIs por evento (docs/05 §5) ---------- */

export type EventKpis = {
  total: number;
  confirmed: number;       // confirmados + check-in
  checkin: number;
  pending: number;
  confirmRate: number;     // %
  spent: number;           // soma de saídas
  income: number;          // soma de entradas
  pendingPay: number;      // saídas com pagamento pendente
  budgetPct: number;       // % do orçamento gasto
  available: number;       // orçamento - gasto
  costPerAttendee: number;
  tasksTotal: number;
  tasksDone: number;
  tasksLate: number;
};

export function eventKpis(s: DbState, eventId: string): EventKpis {
  const ev = eventById(s, eventId);
  const people = attendeesOf(s, eventId).filter((a) => a.status !== "cancelado");
  const tasks = tasksOf(s, eventId);
  const txs = txOf(s, eventId);

  const checkin = people.filter((a) => a.status === "checkin").length;
  const confirmed = people.filter((a) => a.status === "confirmado").length + checkin;
  const spent = txs.filter((t) => t.kind === "saida").reduce((sum, t) => sum + t.amount, 0);
  const income = txs.filter((t) => t.kind === "entrada").reduce((sum, t) => sum + t.amount, 0);
  const budget = ev?.budget_planned ?? 0;
  const tasksDone = tasks.filter((t) => t.status === "concluida").length;

  return {
    total: people.length,
    confirmed,
    checkin,
    pending: people.filter((a) => a.status === "pendente").length,
    confirmRate: people.length ? Math.round((confirmed / people.length) * 100) : 0,
    spent,
    income,
    pendingPay: txs
      .filter((t) => t.kind === "saida" && t.payment_status === "pendente")
      .reduce((sum, t) => sum + t.amount, 0),
    budgetPct: budget ? Math.round((spent / budget) * 100) : 0,
    available: budget - spent,
    costPerAttendee: people.length ? Math.round(spent / people.length) : 0,
    tasksTotal: tasks.length,
    tasksDone,
    tasksLate: tasks.filter(isTaskLate).length,
  };
}

/** Inscritos por semana (últimas `weeks` semanas, FR-F1). */
export function weeklySignups(s: DbState, eventId: string, weeks = 8): { l: string; v: number }[] {
  const people = attendeesOf(s, eventId);
  const msWeek = 7 * 86400000;
  const end = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const from = end - (weeks - i) * msWeek;
    const to = from + msWeek;
    return {
      l: "S" + (i + 1),
      v: people.filter((a) => {
        const t = new Date(a.created_at).getTime();
        return t >= from && t < to;
      }).length,
    };
  });
}

/** Gasto por categoria (FR-E3), ordenado do maior para o menor. */
export function categoryTotals(s: DbState, eventId: string) {
  const txs = txOf(s, eventId).filter((t) => t.kind === "saida");
  const totals = new Map<string, number>();
  for (const t of txs) {
    const key = t.category_id ?? "none";
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }
  const max = Math.max(...totals.values(), 1);
  return [...totals.entries()]
    .map(([id, value]) => ({
      id,
      name: categoryById(s, id)?.name ?? "Sem categoria",
      value,
      pct: Math.round((value / max) * 100),
    }))
    .sort((a, b) => b.value - a.value);
}

/** Estatísticas por membro (tarefas atribuídas e eventos em que atua). */
export function memberStats(s: DbState, memberId: string) {
  const mine = s.tasks.filter((t) => t.assignee_id === memberId);
  return { tasks: mine.length, events: new Set(mine.map((t) => t.event_id)).size };
}

/** Contadores da sidebar (eventos ativos, inscritos do workspace, tarefas abertas). */
export function sidebarCounts(s: DbState) {
  const ev = selectedEvent(s);
  const openTasks = ev ? tasksOf(s, ev.id).filter((t) => t.status === "aberta") : [];
  return {
    events: s.events.filter((e) => e.status !== "encerrado" && e.status !== "cancelado").length,
    attendees: ev ? attendeesOf(s, ev.id).filter((a) => a.status !== "cancelado").length : 0,
    lateTasks: openTasks.filter(isTaskLate).length,
    openTasks: openTasks.length,
  };
}
