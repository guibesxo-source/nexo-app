// Seletores derivados (puros) — as agregações de dashboard do docs/05 §5,
// calculadas a partir das tabelas-fonte, nunca armazenadas. No Supabase
// virarão views/queries (ex.: event_overview).

import type {
  Attendee,
  AttendeeStatus,
  ChecklistTemplate,
  CustomMetric,
  CustomMetricFormat,
  CustomMetricSource,
  DashboardConfig,
  Event,
  EventPriority,
  EventStatus,
  Task,
  TaskPhase,
  Transaction,
} from "@/types";
import type { DbState } from "./seed";
import { BUILTIN_TEMPLATES } from "./actions";
import { fmtMoney } from "@/lib/format";

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

/* ---------- Fases do checklist (pré / durante / pós) ---------- */

/** Fases na ordem em que aparecem no checklist. */
export const PHASE_META: { id: TaskPhase; label: string; short: string }[] = [
  { id: "pre", label: "Pré-evento", short: "Pré" },
  { id: "durante", label: "Durante o evento", short: "Durante" },
  { id: "pos", label: "Pós-evento", short: "Pós" },
];

const PHASE_BY_ID = new Map(PHASE_META.map((p) => [p.id, p]));

export const phaseLabel = (id: TaskPhase): string => PHASE_BY_ID.get(id)?.label ?? id;

/**
 * Fase efetiva da tarefa: usa a explícita quando existe; senão deriva do prazo
 * em relação à data do evento (antes = pré, no dia = durante, depois = pós).
 * Tarefas sem prazo ou sem evento caem em "pré".
 */
export function phaseOf(t: Task, event?: Event): TaskPhase {
  if (t.phase) return t.phase;
  if (!event?.starts_at || !t.due_date) return "pre";
  const start = new Date(event.starts_at);
  const due = new Date(t.due_date + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return "pre";
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const delta = Math.round((due.getTime() - startDay.getTime()) / 86400000);
  return delta < 0 ? "pre" : delta === 0 ? "durante" : "pos";
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
export type DateRange = {
  from?: string;
  to?: string;
  days?: number;
  weeks?: number;
};

const dayMs = 86400000;
const weekMs = 7 * dayMs;
const signupDateFieldKeys = [
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
];

function startOfDayMs(dateOnly: string): number | null {
  const d = new Date(`${dateOnly}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function endOfDayMs(dateOnly: string): number | null {
  const d = new Date(`${dateOnly}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function shortDateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function localDateOnly(ms: number): string {
  const d = new Date(ms);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateTimeMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10000000000 ? value * 1000 : value;
    return Number.isFinite(ms) ? ms : null;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw);
    const ms = raw.length === 10 ? n * 1000 : n;
    return Number.isFinite(ms) ? ms : null;
  }

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = br;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  const isoLocal = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoLocal;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function signupTimeMs(a: Attendee): number {
  for (const key of signupDateFieldKeys) {
    const field = (a.lead_fields ?? []).find((item) => item.key === key);
    const ms = dateTimeMs(field?.value);
    if (ms != null) return ms;
  }

  return dateTimeMs(a.created_at) ?? 0;
}

export function attendeeSignupAt(a: Attendee): string {
  const ms = signupTimeMs(a);
  return ms ? new Date(ms).toISOString() : a.created_at;
}

export function signupsByDate(s: DbState, eventId: string, range: DateRange = {}): { l: string; v: number }[] {
  const people = attendeesOf(s, eventId).filter((a) => a.status !== "cancelado");
  const todayEnd = endOfDayMs(localDateOnly(Date.now())) ?? Date.now();
  const explicitFrom = range.from ? startOfDayMs(range.from) : null;
  const explicitTo = range.to ? endOfDayMs(range.to) : null;
  const end = explicitTo ?? todayEnd;
  const days = range.days ?? 14;
  const start = explicitFrom ?? startOfDayMs(localDateOnly(end - (days - 1) * dayMs)) ?? end;
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end);
  const span = safeEnd - safeStart;
  const bucketMs = span <= 21 * dayMs ? dayMs : weekMs;
  const bucketCount = Math.max(1, Math.ceil((safeEnd - safeStart + 1) / bucketMs));

  return Array.from({ length: bucketCount }, (_, i) => {
    const from = safeStart + i * bucketMs;
    const to = i === bucketCount - 1 ? safeEnd + 1 : from + bucketMs;
    return {
      l: shortDateLabel(from),
      v: people.filter((a) => {
        const t = signupTimeMs(a);
        return t >= from && t < to;
      }).length,
    };
  });
}

export function weeklySignups(s: DbState, eventId: string, range: DateRange = {}): { l: string; v: number }[] {
  return signupsByDate(s, eventId, { ...range, days: range.days ?? (range.weeks ?? 8) * 7 });
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

/* ---------- Dashboard customizável: catálogo de métricas + layout padrão ---------- */

export type MetricDef = {
  key: string;
  label: string;
  icon: string;
  tone?: string;
  format: CustomMetricFormat;
  value: (k: EventKpis) => number;
};

/** Métricas prontas do catálogo (KPIs derivados de eventKpis). */
export const METRIC_CATALOG: MetricDef[] = [
  { key: "total", label: "Inscritos totais", icon: "users", tone: "green", format: "number", value: (k) => k.total },
  { key: "confirmed", label: "Confirmados", icon: "check", format: "number", value: (k) => k.confirmed },
  { key: "pending", label: "Pendentes", icon: "clock", format: "number", value: (k) => k.pending },
  { key: "checkin", label: "Check-ins", icon: "ticket", format: "number", value: (k) => k.checkin },
  { key: "confirmRate", label: "Taxa de confirmação", icon: "trending", format: "percent", value: (k) => k.confirmRate },
  { key: "income", label: "Receitas", icon: "arrowDown", tone: "green", format: "money", value: (k) => k.income },
  { key: "spent", label: "Gasto", icon: "wallet", format: "money", value: (k) => k.spent },
  { key: "available", label: "Saldo disponível", icon: "wallet", format: "money", value: (k) => k.available },
  { key: "budgetPct", label: "Orçamento usado", icon: "wallet", format: "percent", value: (k) => k.budgetPct },
  { key: "costPerAttendee", label: "Custo por inscrito", icon: "wallet", format: "money", value: (k) => k.costPerAttendee },
  { key: "tasksDone", label: "Tarefas concluídas", icon: "checkSquare", format: "number", value: (k) => k.tasksDone },
  { key: "tasksLate", label: "Tarefas atrasadas", icon: "checkSquare", tone: "red", format: "number", value: (k) => k.tasksLate },
];

const METRIC_BY_KEY = new Map(METRIC_CATALOG.map((m) => [m.key, m]));
export const catalogMetric = (key: string): MetricDef | undefined => METRIC_BY_KEY.get(key);

/** Formata um valor numérico conforme o formato da métrica. */
export function formatMetricValue(value: number, format: CustomMetricFormat): string {
  if (format === "money") return fmtMoney(value);
  if (format === "percent") return `${value}%`;
  return value.toLocaleString("pt-BR");
}

const SOURCE_ICON: Record<CustomMetricSource, string> = {
  inscritos: "users",
  financeiro: "wallet",
  checklist: "checkSquare",
};

export const customMetricIcon = (source: CustomMetricSource): string => SOURCE_ICON[source];

/** Calcula o valor de uma métrica personalizada a partir dos dados do evento. */
export function customMetricValue(s: DbState, eventId: string, m: CustomMetric): number {
  if (m.source === "inscritos") {
    const people = attendeesOf(s, eventId).filter((a) => a.status !== "cancelado");
    if (!m.filter || m.filter === "todos") return people.length;
    return people.filter((a) => a.status === m.filter).length;
  }
  if (m.source === "financeiro") {
    const txs = txOf(s, eventId);
    const scope = !m.filter || m.filter === "todos" ? txs : txs.filter((t) => t.kind === m.filter);
    return m.agg === "sum" ? scope.reduce((sum, t) => sum + t.amount, 0) : scope.length;
  }
  // checklist
  const tasks = tasksOf(s, eventId);
  if (m.filter === "atrasada") return tasks.filter(isTaskLate).length;
  if (m.filter === "concluida") return tasks.filter((t) => t.status === "concluida").length;
  if (m.filter === "aberta") return tasks.filter((t) => t.status === "aberta").length;
  return tasks.length;
}

/** Layout inicial do dashboard (espelha o painel fixo anterior). */
export const DEFAULT_DASHBOARD: DashboardConfig = {
  widgets: [
    { id: "w-total", type: "kpi", metric: "total", span: 1 },
    { id: "w-confirmed", type: "kpi", metric: "confirmed", span: 1 },
    { id: "w-budget", type: "kpi", metric: "budgetPct", span: 1 },
    { id: "w-tasks", type: "kpi", metric: "tasksDone", span: 1 },
    { id: "w-signups", type: "chart-signups", span: 3 },
    { id: "w-confirm", type: "chart-confirm", span: 1 },
    { id: "w-activity", type: "list-activity", span: 2 },
    { id: "w-progress", type: "list-progress", span: 2 },
  ],
  customMetrics: [],
};

/** Config efetiva do dashboard: a salva ou o padrão. */
export const dashboardConfig = (s: DbState): DashboardConfig =>
  s.settings.dashboard ?? DEFAULT_DASHBOARD;

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
