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
  EventFile,
  EventFileCategory,
  EventPriority,
  EventStatus,
  Task,
  TaskPhase,
  Transaction,
} from "@/types";
import type { DbState } from "./seed";
import { BUILTIN_TEMPLATES } from "./actions";
import { daysUntil, fmtMoney } from "@/lib/format";

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
  costPerConfirmed: number;     // gasto / confirmados
  revenuePerAttendee: number;   // receita / inscrito
  resultPerAttendee: number;    // (receita - gasto) / inscrito
  targetCostPerAttendee: number; // orçamento / capacidade (custo-alvo na lotação)
  goal: number;                  // meta de inscritos (capacidade do evento)
  remainingSeats: number;        // vagas faltando para a meta (>= 0)
  daysToEvent: number;           // dias até o evento (negativo se já passou)
  neededPerDay: number;          // inscritos/dia necessários para bater a meta
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
  const goal = ev?.capacity ?? 0;
  const remainingSeats = goal ? Math.max(0, goal - people.length) : 0;
  const daysToEvent = ev?.starts_at ? daysUntil(ev.starts_at) : 0;
  const neededPerDay = remainingSeats > 0 && daysToEvent > 0 ? Math.ceil(remainingSeats / daysToEvent) : 0;

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
    costPerConfirmed: confirmed ? Math.round(spent / confirmed) : 0,
    revenuePerAttendee: people.length ? Math.round(income / people.length) : 0,
    resultPerAttendee: people.length ? Math.round((income - spent) / people.length) : 0,
    targetCostPerAttendee: ev?.capacity ? Math.round(budget / ev.capacity) : 0,
    goal,
    remainingSeats,
    daysToEvent,
    neededPerDay,
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

/**
 * Inscritos por dia — uma entrada por dia que teve ≥1 inscrição (dias vazios
 * são omitidos). Usado no "desde o início" para ver o histórico real dia a dia.
 */
export function signupsPerDay(s: DbState, eventId: string, range: DateRange = {}): { l: string; v: number }[] {
  const people = attendeesOf(s, eventId).filter((a) => a.status !== "cancelado");
  const fromMs = range.from ? startOfDayMs(range.from) : null;
  const toMs = range.to ? endOfDayMs(range.to) : endOfDayMs(localDateOnly(Date.now()));
  const counts = new Map<string, number>();
  for (const a of people) {
    const t = signupTimeMs(a);
    if (!t) continue;
    if (fromMs != null && t < fromMs) continue;
    if (toMs != null && t > toMs) continue;
    const day = localDateOnly(t);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ l: shortDateLabel(startOfDayMs(day) ?? 0), v }));
}

/** Data (YYYY-MM-DD) do primeiro inscrito do evento — "desde o início". */
export function firstSignupDate(s: DbState, eventId: string): string | null {
  let min = Infinity;
  for (const a of attendeesOf(s, eventId)) {
    if (a.status === "cancelado") continue;
    const t = signupTimeMs(a);
    if (t > 0 && t < min) min = t;
  }
  return min === Infinity ? null : localDateOnly(min);
}

/** Gasto por categoria (FR-E3), ordenado do maior para o menor. Inclui ícone,
   contagem de lançamentos, `pct` (largura da barra vs. maior) e `share` (% do total). */
export function categoryTotals(s: DbState, eventId: string) {
  const txs = txOf(s, eventId).filter((t) => t.kind === "saida");
  const totals = new Map<string, { value: number; count: number }>();
  for (const t of txs) {
    const key = t.category_id ?? "none";
    const cur = totals.get(key) ?? { value: 0, count: 0 };
    totals.set(key, { value: cur.value + t.amount, count: cur.count + 1 });
  }
  const max = Math.max(...[...totals.values()].map((v) => v.value), 1);
  const total = [...totals.values()].reduce((sum, v) => sum + v.value, 0) || 1;
  return [...totals.entries()]
    .map(([id, { value, count }]) => ({
      id,
      name: categoryById(s, id)?.name ?? "Sem categoria",
      icon: categoryById(s, id)?.icon ?? "💳",
      value,
      count,
      pct: Math.round((value / max) * 100),
      share: Math.round((value / total) * 100),
    }))
    .sort((a, b) => b.value - a.value);
}

/* ---------- Arquivos do evento (mídia kit, fotos, briefing, metas) ---------- */

export const EVENT_FILE_CATEGORIES: { id: EventFileCategory; label: string; icon: string; hint: string }[] = [
  { id: "midia-kit", label: "Mídia kit", icon: "image", hint: "Logos, fontes, manual de marca" },
  { id: "criativos", label: "Criativos", icon: "sparkle", hint: "Peças de anúncio, posts e banners" },
  { id: "fotos", label: "Fotos", icon: "camera", hint: "Álbuns e registros do evento" },
  { id: "briefing", label: "Briefing", icon: "note", hint: "Escopo, roteiro e referências" },
  { id: "metas", label: "Metas", icon: "trending", hint: "Objetivos e indicadores" },
  { id: "off", label: "Materiais off", icon: "paperclip", hint: "Impressos, sinalização e brindes" },
  { id: "documento", label: "Documentos", icon: "paperclip", hint: "Contratos, planilhas, PDFs" },
  { id: "outro", label: "Outros", icon: "grid", hint: "Demais arquivos do evento" },
];

const EVENT_FILE_CAT_BY_ID = new Map(EVENT_FILE_CATEGORIES.map((c) => [c.id, c]));

export const eventFileCategoryMeta = (id: EventFileCategory) =>
  EVENT_FILE_CAT_BY_ID.get(id) ?? EVENT_FILE_CATEGORIES[EVENT_FILE_CATEGORIES.length - 1];

/** Arquivos/recursos de um evento (mais recentes primeiro). */
export function eventFilesOf(s: DbState, eventId: string): EventFile[] {
  return s.settings.event_files?.[eventId] ?? [];
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
  { key: "neededPerDay", label: "Inscritos/dia p/ meta", icon: "trending", format: "number", value: (k) => k.neededPerDay },
  { key: "income", label: "Receitas", icon: "arrowDown", tone: "green", format: "money", value: (k) => k.income },
  { key: "spent", label: "Gasto", icon: "wallet", format: "money", value: (k) => k.spent },
  { key: "available", label: "Saldo disponível", icon: "wallet", format: "money", value: (k) => k.available },
  { key: "budgetPct", label: "Orçamento usado", icon: "wallet", format: "percent", value: (k) => k.budgetPct },
  { key: "costPerAttendee", label: "Custo por inscrito", icon: "wallet", format: "money", value: (k) => k.costPerAttendee },
  { key: "costPerConfirmed", label: "Custo por confirmado", icon: "wallet", format: "money", value: (k) => k.costPerConfirmed },
  { key: "revenuePerAttendee", label: "Receita por inscrito", icon: "arrowDown", tone: "green", format: "money", value: (k) => k.revenuePerAttendee },
  { key: "resultPerAttendee", label: "Resultado por inscrito", icon: "trending", format: "money", value: (k) => k.resultPerAttendee },
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

/* ---------- Insights ativos (mudam conforme a performance do evento) ---------- */

export type Tone = "green" | "amber" | "red" | "blue" | "gray";

/** Inscrições numa janela de `days` dias que termina `offsetDays` atrás. */
function signupsInWindow(s: DbState, eventId: string, days: number, offsetDays: number): number {
  const end = Date.now() - offsetDays * dayMs;
  const start = end - days * dayMs;
  return attendeesOf(s, eventId)
    .filter((a) => a.status !== "cancelado")
    .filter((a) => {
      const t = signupTimeMs(a);
      return t > start && t <= end;
    }).length;
}

/** Frase curta de contexto para um KPI — preenche o rodapé do card e muda
   conforme os números do evento. Métricas sem leitura útil devolvem null. */
export function metricInsight(key: string, k: EventKpis, ev?: Event): { text: string; tone: Tone } | null {
  switch (key) {
    case "total": {
      if (ev?.capacity) {
        const pct = Math.round((k.total / ev.capacity) * 100);
        const left = ev.capacity - k.total;
        if (left <= 0) return { text: "Lotação esgotada", tone: "green" };
        return { text: `${pct}% da lotação · faltam ${left}`, tone: pct >= 80 ? "amber" : "blue" };
      }
      return k.total ? { text: `${k.confirmed} confirmados`, tone: "gray" } : null;
    }
    case "confirmed":
    case "confirmRate":
      if (!k.total) return null;
      return {
        text: k.confirmRate >= 70 ? "Boa adesão" : k.confirmRate >= 40 ? "Adesão mediana" : "Adesão baixa",
        tone: k.confirmRate >= 70 ? "green" : k.confirmRate >= 40 ? "amber" : "red",
      };
    case "neededPerDay":
      if (!k.goal) return null;
      if (k.remainingSeats <= 0) return { text: `Meta de ${k.goal} atingida`, tone: "green" };
      if (k.neededPerDay <= 0) return { text: `Faltam ${k.remainingSeats} p/ meta`, tone: "amber" };
      return { text: `${k.remainingSeats} vagas em ${k.daysToEvent} dias`, tone: "blue" };
    case "pending":
      return k.pending > 0
        ? { text: "Aguardando confirmação", tone: "amber" }
        : { text: "Nada pendente", tone: "green" };
    case "checkin": {
      const rate = k.confirmed ? Math.round((k.checkin / k.confirmed) * 100) : 0;
      return { text: `${rate}% de presença`, tone: rate >= 70 ? "green" : "gray" };
    }
    case "budgetPct":
      if (k.budgetPct > 100) return { text: `Estourou ${k.budgetPct - 100}%`, tone: "red" };
      return { text: `${fmtMoney(k.available)} disponível`, tone: k.budgetPct >= 85 ? "amber" : "green" };
    case "spent":
      return k.pendingPay > 0
        ? { text: `${fmtMoney(k.pendingPay)} a pagar`, tone: "amber" }
        : { text: "Sem pendências", tone: "gray" };
    case "available":
      return k.available < 0
        ? { text: "Acima do orçamento", tone: "red" }
        : { text: "Dentro do orçamento", tone: "green" };
    case "income":
      return k.total ? { text: `${fmtMoney(k.revenuePerAttendee)} por inscrito`, tone: "green" } : null;
    case "costPerAttendee":
    case "costPerConfirmed":
    case "resultPerAttendee":
      if (!k.total) return null;
      return k.resultPerAttendee >= 0
        ? { text: `Resultado +${fmtMoney(k.resultPerAttendee)}/inscrito`, tone: "green" }
        : { text: `Resultado ${fmtMoney(k.resultPerAttendee)}/inscrito`, tone: "red" };
    case "revenuePerAttendee":
      return { text: `Custo ${fmtMoney(k.costPerAttendee)}/inscrito`, tone: "gray" };
    case "tasksDone":
      return k.tasksTotal
        ? { text: `${k.tasksDone}/${k.tasksTotal} concluídas`, tone: k.tasksDone === k.tasksTotal ? "green" : "gray" }
        : null;
    case "tasksLate":
      return { text: k.tasksLate > 0 ? "Precisa de atenção" : "Tudo em dia", tone: k.tasksLate > 0 ? "red" : "green" };
    default:
      return null;
  }
}

export type Insight = { icon: string; tone: Tone; text: string };

/** Insights ativos do evento — ordenados por urgência, mudam com a performance. */
export function eventInsights(s: DbState, eventId: string): Insight[] {
  const ev = eventById(s, eventId);
  const k = eventKpis(s, eventId);
  const out: Insight[] = [];

  if (ev?.capacity) {
    const pct = Math.round((k.total / ev.capacity) * 100);
    const left = ev.capacity - k.total;
    if (left <= 0) out.push({ icon: "users", tone: "green", text: `Lotação esgotada — ${k.total}/${ev.capacity} inscritos` });
    else if (pct >= 80) out.push({ icon: "users", tone: "amber", text: `Quase lotado: faltam ${left} vagas (${pct}%)` });
    else out.push({ icon: "users", tone: "blue", text: `${pct}% da lotação preenchida · faltam ${left} vagas` });
  }

  const last7 = signupsInWindow(s, eventId, 7, 0);
  const prev7 = signupsInWindow(s, eventId, 7, 7);
  if (last7 + prev7 > 0) {
    if (last7 > prev7) out.push({ icon: "trending", tone: "green", text: `Inscrições aceleraram: ${last7} nos últimos 7 dias (antes ${prev7})` });
    else if (last7 < prev7) out.push({ icon: "trending", tone: "amber", text: `Inscrições desaceleraram: ${last7} nos últimos 7 dias (antes ${prev7})` });
  }

  // Ritmo necessário para bater a meta vs. ritmo real dos últimos 7 dias.
  if (k.neededPerDay > 0) {
    const avgPerDay = last7 / 7;
    const behind = k.neededPerDay > avgPerDay + 0.5;
    out.push({
      icon: "trending",
      tone: behind ? "amber" : "green",
      text:
        `Meta: ${k.neededPerDay} inscrito${k.neededPerDay === 1 ? "" : "s"}/dia para lotar — faltam ${k.remainingSeats} em ${k.daysToEvent} dias` +
        (avgPerDay > 0 ? ` (ritmo atual ${avgPerDay.toFixed(1)}/dia)` : ""),
    });
  } else if (ev?.capacity && k.remainingSeats > 0 && k.daysToEvent <= 0) {
    out.push({ icon: "users", tone: "amber", text: `Faltaram ${k.remainingSeats} para a meta de ${ev.capacity}` });
  }

  if (k.total > 0 && k.confirmRate < 60) {
    out.push({ icon: "check", tone: "amber", text: `Taxa de confirmação em ${k.confirmRate}% · ${k.pending} pendentes` });
  }

  if (k.budgetPct > 100) out.push({ icon: "wallet", tone: "red", text: `Orçamento estourado em ${k.budgetPct - 100}% (${fmtMoney(-k.available)} acima)` });
  else if (k.budgetPct >= 85) out.push({ icon: "wallet", tone: "amber", text: `Orçamento quase no limite: ${k.budgetPct}% usado` });

  if (k.total > 0 && k.resultPerAttendee < 0) {
    out.push({ icon: "trending", tone: "red", text: `No vermelho: cada inscrito custa ${fmtMoney(-k.resultPerAttendee)} a mais do que gera` });
  } else if (k.resultPerAttendee > 0) {
    out.push({ icon: "trending", tone: "green", text: `No azul: +${fmtMoney(k.resultPerAttendee)} de resultado por inscrito` });
  }

  if (k.tasksLate > 0) {
    out.push({ icon: "checkSquare", tone: "red", text: `${k.tasksLate} tarefa${k.tasksLate === 1 ? "" : "s"} atrasada${k.tasksLate === 1 ? "" : "s"} no checklist` });
  }

  if (ev?.starts_at) {
    const d = daysUntil(ev.starts_at);
    if (d >= 0 && d <= 14) {
      out.push({ icon: "calendar", tone: d <= 3 ? "amber" : "blue", text: d === 0 ? "É hoje! 🎉" : `Faltam ${d} dia${d === 1 ? "" : "s"} para o evento` });
    }
  }

  return out;
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
    { id: "w-total", type: "kpi", metric: "total", span: 2, sideMetrics: ["confirmed", "pending"] },
    { id: "w-budget", type: "kpi", metric: "budgetPct", span: 1 },
    { id: "w-tasks", type: "kpi", metric: "tasksDone", span: 1 },
    { id: "w-signups", type: "chart-signups", span: 3 },
    { id: "w-confirm", type: "chart-confirm", span: 1 },
    { id: "w-cost", type: "block-cost", span: 2 },
    { id: "w-insights", type: "list-insights", span: 2 },
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
