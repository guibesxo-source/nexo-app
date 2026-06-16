// Mutações da camada de dados — uma função por operação. Cada uma muta a
// memória (mutate → UI reativa, instantânea) e grava write-through no Supabase
// (sb*). A UI só importa de @/lib/db e não sabe que existe banco.

import type {
  Attendee,
  AttendeeStatus,
  AppSettings,
  ChecklistTemplate,
  ChecklistTemplateItem,
  CustomMetric,
  DashboardConfig,
  DashboardWidget,
  Event,
  EventFormat,
  EventPriority,
  Member,
  SymplaEventLink,
  Task,
  TaskAttachment,
  TaskPhase,
  TicketType,
  Transaction,
  TxKind,
  TxPayment,
} from "@/types";
import { initialsOf, fmtMoney } from "@/lib/format";
import {
  clearSession,
  currentWorkspaceId,
  mutate,
  newId,
  rehydrate,
  saveSelectedEvent,
  saveSettings,
  sbDelete,
  sbInsert,
  sbUpdate,
} from "./store";
import {
  activityToRow,
  attendeeToRow,
  eventToRow,
  memberToRow,
  taskToRow,
  transactionToRow,
  templateToRow,
  attachmentToRow,
} from "./supabase-map";
import { DEFAULT_DASHBOARD, customMetricIcon } from "./derived";

const now = () => new Date().toISOString();
const ws = () => currentWorkspaceId();

type Row = Record<string, unknown>;

function logActivity(icon: string, text: string[]) {
  const entry = { id: newId(), icon, text, created_at: now() };
  mutate((s) => ({ ...s, activity: [entry, ...s.activity].slice(0, 50) }));
  const w = ws();
  if (w) sbInsert("activity", activityToRow(w, entry));
}

/** Patch de task (UI) → patch de linha (renomeia group → task_group). */
function taskPatchToRow(patch: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k === "group" ? "task_group" : k] = v;
  }
  return out;
}

/* ---------- Sessão ---------- */

/** Login: identidade e dados vêm do Supabase — (re)hidrata o workspace do usuário. */
export function login(_name: string, _email: string) {
  void rehydrate();
}

export function logout() {
  clearSession();
}

export function selectEvent(eventId: string) {
  mutate((s) => ({ ...s, session: { ...s.session, selected_event_id: eventId } }));
  saveSelectedEvent(eventId);
}

/* ---------- Eventos ---------- */

/** Catálogo de capas dos eventos — os gradientes usados nos cards de Eventos. */
export type EventCover = { id: string; name: string; css: string };

export const EVENT_COVERS: EventCover[] = [
  { id: "esmeralda", name: "Esmeralda", css: "linear-gradient(135deg,#00B863,#0A0A0A)" },
  { id: "violeta", name: "Violeta", css: "linear-gradient(135deg,#7C3AED,#0A0A0A)" },
  { id: "ceu", name: "Céu", css: "linear-gradient(135deg,#0EA5E9,#0A0A0A)" },
  { id: "oceano", name: "Oceano", css: "linear-gradient(135deg,#0891B2,#0A0A0A)" },
  { id: "ambar", name: "Âmbar", css: "linear-gradient(135deg,#B45309,#0A0A0A)" },
  { id: "grafite", name: "Grafite", css: "linear-gradient(135deg,#1A1A1A,#444)" },
];

export type EventDraft = Pick<
  Event,
  "name" | "status" | "starts_at" | "location" | "capacity" | "budget_planned"
> & { cover?: string; format?: EventFormat; priority?: EventPriority };

export function createEvent(draft: EventDraft): string {
  const id = newId();
  let event!: Event;
  mutate((s) => {
    event = {
      ...draft,
      id,
      cover: draft.cover ?? EVENT_COVERS[s.events.length % EVENT_COVERS.length].css,
      created_at: now(),
    };
    return {
      ...s,
      events: [event, ...s.events],
      session: { ...s.session, selected_event_id: id },
    };
  });
  saveSelectedEvent(id);
  const w = ws();
  if (w) sbInsert("events", eventToRow(w, event));
  logActivity("🗓️", ["Evento ", draft.name, " criado"]);
  return id;
}

export function updateEvent(id: string, patch: Partial<EventDraft>) {
  mutate((s) => ({
    ...s,
    events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
  if (ws()) sbUpdate("events", id, patch as Row);
}

export function deleteEvent(id: string) {
  let selected: string | null = null;
  let leadSettingsChanged = false;
  mutate((s) => {
    const removedAttendeeIds = s.attendees.filter((a) => a.event_id === id).map((a) => a.id);
    const leadStore = removeLeadFieldStoreEntries(
      s.settings.attendee_lead_fields,
      removedAttendeeIds
    );
    leadSettingsChanged = leadStore.changed;
    const events = s.events.filter((e) => e.id !== id);
    selected =
      s.session.selected_event_id === id
        ? (events[0]?.id ?? null)
        : s.session.selected_event_id;
    return {
      ...s,
      events,
      attendees: s.attendees.filter((a) => a.event_id !== id),
      tasks: s.tasks.filter((t) => t.event_id !== id),
      transactions: s.transactions.filter((t) => t.event_id !== id),
      session: { ...s.session, selected_event_id: selected },
      settings: leadStore.changed
        ? { ...s.settings, attendee_lead_fields: leadStore.value }
        : s.settings,
    };
  });
  saveSelectedEvent(selected);
  if (leadSettingsChanged) saveSettings();
  // FK on delete cascade derruba attendees/tasks/transactions/anexos no banco.
  if (ws()) sbDelete("events", id);
}

/* ---------- Inscritos ---------- */

export type AttendeeDraft = Pick<Attendee, "name" | "email" | "company"> & {
  ticket: TicketType;
  status: AttendeeStatus;
  external_source?: Attendee["external_source"];
  external_id?: string | null;
  lead_fields?: Attendee["lead_fields"];
  created_at?: string;
};

export type AttendeeImportResult = {
  added: number;
  skipped: number;
  updated: number;
};

function importedDraft(draft: AttendeeDraft): AttendeeDraft {
  return { ...draft, status: "pendente" };
}

export function addAttendee(eventId: string, draft: AttendeeDraft): string {
  const id = newId();
  const attendee: Attendee = { ...draft, id, event_id: eventId, created_at: draft.created_at ?? now() };
  mutate((s) => ({ ...s, attendees: [attendee, ...s.attendees] }));
  const w = ws();
  if (w) sbInsert("attendees", attendeeToRow(w, attendee));
  logActivity("🎫", ["", draft.name, " inscrito(a) no evento"]);
  return id;
}

export function setAttendeeStatus(id: string, status: AttendeeStatus) {
  let name = "";
  mutate((s) => ({
    ...s,
    attendees: s.attendees.map((a) => {
      if (a.id === id) name = a.name;
      return a.id === id ? { ...a, status } : a;
    }),
  }));
  if (ws()) sbUpdate("attendees", id, { status });
  if (status === "confirmado") logActivity("👤", ["", name, " confirmou presença"]);
  if (status === "checkin") logActivity("✅", ["", name, " fez check-in"]);
}

/**
 * Importação em lote (CSV/Sympla) — deduplica por email dentro do evento.
 * Retorna quantos entraram e quantos foram pulados por já existirem.
 */
export function importAttendees(
  eventId: string,
  drafts: AttendeeDraft[]
): AttendeeImportResult {
  let added = 0;
  let skipped = 0;
  const fresh: Attendee[] = [];
  let leadSettingsChanged = false;
  mutate((s) => {
    const seen = new Set(
      s.attendees.filter((a) => a.event_id === eventId).map((a) => a.email.toLowerCase())
    );
    for (const d of drafts) {
      const draft = importedDraft(d);
      const key = draft.email.trim().toLowerCase();
      if (!key || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      fresh.push({ ...draft, id: newId(), event_id: eventId, created_at: draft.created_at ?? now() });
      added++;
    }
    if (!fresh.length) return s;
    const leadStore = updateLeadFieldStore(s.settings.attendee_lead_fields, fresh);
    leadSettingsChanged = leadStore.changed;
    return {
      ...s,
      attendees: [...fresh, ...s.attendees],
      settings: leadStore.changed
        ? { ...s.settings, attendee_lead_fields: leadStore.value }
        : s.settings,
    };
  });
  if (leadSettingsChanged) saveSettings();
  const w = ws();
  if (w && fresh.length) sbInsert("attendees", fresh.map((a) => attendeeToRow(w, a)));
  if (added > 0) {
    logActivity("📥", ["", `${added} inscrito${added === 1 ? "" : "s"}`, " importados para o evento"]);
  }
  return { added, skipped, updated: 0 };
}

const externalKey = (a: Pick<AttendeeDraft, "external_source" | "external_id">) =>
  a.external_source && a.external_id ? `${a.external_source}:${a.external_id}` : null;

const emailKey = (email: string) => email.trim().toLowerCase();

function updateLeadFieldStore(
  current: AppSettings["attendee_lead_fields"],
  attendees: Attendee[]
): { value: AppSettings["attendee_lead_fields"]; changed: boolean } {
  const next = { ...(current ?? {}) };
  let changed = false;

  for (const attendee of attendees) {
    const fields = (attendee.lead_fields ?? []).filter((field) => field.label && field.value);
    if (fields.length > 0) {
      if (JSON.stringify(next[attendee.id] ?? []) !== JSON.stringify(fields)) {
        next[attendee.id] = fields;
        changed = true;
      }
    } else if (next[attendee.id]) {
      delete next[attendee.id];
      changed = true;
    }
  }

  return { value: next, changed };
}

function removeLeadFieldStoreEntries(
  current: AppSettings["attendee_lead_fields"],
  ids: string[]
): { value: AppSettings["attendee_lead_fields"]; changed: boolean } {
  if (!current) return { value: current, changed: false };
  const next = { ...current };
  let changed = false;
  for (const id of ids) {
    if (next[id]) {
      delete next[id];
      changed = true;
    }
  }
  return { value: next, changed };
}

function sameAttendeeData(a: Attendee, d: AttendeeDraft): boolean {
  return (
    a.name === d.name &&
    a.email === d.email &&
    a.company === d.company &&
    a.ticket === d.ticket &&
    a.status === d.status &&
    (a.external_source ?? null) === (d.external_source ?? null) &&
    (a.external_id ?? null) === (d.external_id ?? null) &&
    JSON.stringify(a.lead_fields ?? []) === JSON.stringify(d.lead_fields ?? []) &&
    (d.created_at === undefined || a.created_at === d.created_at)
  );
}

/**
 * Sincroniza inscritos vindos de uma integracao.
 *
 * Diferente do import CSV, isto atualiza registros existentes e usa
 * external_source/external_id como chave primaria. Para corrigir importacoes
 * antigas do Sympla que foram deduplicadas por email, a primeira ocorrencia de
 * um email legado e adotada pelo external_id; os ingressos seguintes com o
 * mesmo email entram como novas linhas.
 */
export function syncAttendees(eventId: string, drafts: AttendeeDraft[]): AttendeeImportResult {
  let added = 0;
  let skipped = 0;
  let updated = 0;
  let leadSettingsChanged = false;
  const freshList: Attendee[] = [];
  const updatedList: Attendee[] = [];

  mutate((s) => {
    const existing = s.attendees.filter((a) => a.event_id === eventId);
    const byExternal = new Map<string, Attendee>();
    const legacyByEmail = new Map<string, Attendee[]>();

    for (const a of existing) {
      const xk = externalKey(a);
      if (xk) byExternal.set(xk, a);
      else {
        const ek = emailKey(a.email);
        legacyByEmail.set(ek, [...(legacyByEmail.get(ek) ?? []), a]);
      }
    }

    const consumedLegacy = new Set<string>();
    const next = [...s.attendees];

    const replace = (id: string, draft: AttendeeDraft) => {
      const idx = next.findIndex((a) => a.id === id);
      if (idx === -1) return;
      const patched: Attendee = {
        ...next[idx],
        ...draft,
        status: next[idx].status,
        created_at: draft.created_at ?? next[idx].created_at,
      };
      if (sameAttendeeData(next[idx], patched)) {
        skipped++;
        return;
      }
      next[idx] = patched;
      updatedList.push(patched);
      updated++;
    };

    for (const d of drafts) {
      const draft = importedDraft(d);
      const xk = externalKey(draft);
      const ek = emailKey(draft.email);
      const byX = xk ? byExternal.get(xk) : undefined;
      if (byX) {
        replace(byX.id, draft);
        continue;
      }

      const legacy = (legacyByEmail.get(ek) ?? []).find((a) => !consumedLegacy.has(a.id));
      if (xk && legacy) {
        consumedLegacy.add(legacy.id);
        byExternal.set(xk, legacy);
        replace(legacy.id, draft);
        continue;
      }

      if (!xk && existing.some((a) => emailKey(a.email) === ek)) {
        skipped++;
        continue;
      }

      const fresh: Attendee = { ...draft, id: newId(), event_id: eventId, created_at: draft.created_at ?? now() };
      freshList.push(fresh);
      next.unshift(fresh);
      added++;
    }

    if (!freshList.length && updated === 0) return s;
    const leadStore = updateLeadFieldStore(
      s.settings.attendee_lead_fields,
      [...freshList, ...updatedList]
    );
    leadSettingsChanged = leadStore.changed;

    return {
      ...s,
      attendees: next,
      settings: leadStore.changed
        ? { ...s.settings, attendee_lead_fields: leadStore.value }
        : s.settings,
    };
  });
  if (leadSettingsChanged) saveSettings();

  const w = ws();
  if (w) {
    if (freshList.length) sbInsert("attendees", freshList.map((a) => attendeeToRow(w, a)));
    for (const a of updatedList) sbUpdate("attendees", a.id, attendeeToRow(w, a));
  }

  if (added > 0 || updated > 0) {
    logActivity("📥", [
      "",
      `${added} novo${added === 1 ? "" : "s"} / ${updated} atualizado${updated === 1 ? "" : "s"}`,
      " na sincronizacao de inscritos",
    ]);
  }
  return { added, skipped, updated };
}

export function removeAttendee(id: string) {
  let leadSettingsChanged = false;
  mutate((s) => {
    const leadStore = removeLeadFieldStoreEntries(s.settings.attendee_lead_fields, [id]);
    leadSettingsChanged = leadStore.changed;
    return {
      ...s,
      attendees: s.attendees.filter((a) => a.id !== id),
      settings: leadStore.changed
        ? { ...s.settings, attendee_lead_fields: leadStore.value }
        : s.settings,
    };
  });
  if (leadSettingsChanged) saveSettings();
  if (ws()) sbDelete("attendees", id);
}

/* ---------- Checklist ---------- */

export type TaskDraft = Pick<Task, "title" | "group" | "phase" | "assignee_id" | "due_date">;

export function addTask(eventId: string, draft: TaskDraft): string {
  const id = newId();
  const task: Task = { ...draft, id, event_id: eventId, status: "aberta", created_at: now() };
  mutate((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  const w = ws();
  if (w) sbInsert("tasks", taskToRow(w, task));
  return id;
}

export function toggleTask(id: string) {
  let title = "";
  let nowDone = false;
  mutate((s) => ({
    ...s,
    tasks: s.tasks.map((t) => {
      if (t.id !== id) return t;
      title = t.title;
      nowDone = t.status === "aberta";
      return { ...t, status: nowDone ? "concluida" : "aberta" };
    }),
  }));
  if (ws()) sbUpdate("tasks", id, { status: nowDone ? "concluida" : "aberta" });
  if (nowDone) logActivity("✅", ["Tarefa ", `“${title}”`, " concluída"]);
}

export function removeTask(id: string) {
  mutate((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  if (ws()) sbDelete("tasks", id); // anexos caem por FK cascade
}

/* ---------- Detalhe da tarefa (descrição, anexos, custo) ---------- */

export type TaskPatch = Partial<
  Pick<Task, "title" | "group" | "phase" | "assignee_id" | "due_date" | "description" | "cost_estimate">
>;

export function updateTask(id: string, patch: TaskPatch) {
  mutate((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
  if (ws()) sbUpdate("tasks", id, taskPatchToRow(patch));
}

export type TaskAttachmentDraft = Pick<TaskAttachment, "name" | "kind" | "data">;

export function addTaskAttachment(taskId: string, draft: TaskAttachmentDraft) {
  const att: TaskAttachment = { ...draft, id: newId(), added_at: now() };
  mutate((s) => ({
    ...s,
    tasks: s.tasks.map((t) =>
      t.id === taskId ? { ...t, attachments: [...(t.attachments ?? []), att] } : t
    ),
  }));
  const w = ws();
  if (w) sbInsert("task_attachments", attachmentToRow(w, taskId, att));
}

export function removeTaskAttachment(taskId: string, attId: string) {
  mutate((s) => ({
    ...s,
    tasks: s.tasks.map((t) =>
      t.id === taskId
        ? { ...t, attachments: (t.attachments ?? []).filter((a) => a.id !== attId) }
        : t
    ),
  }));
  if (ws()) sbDelete("task_attachments", attId);
}

/**
 * Diferencial Nexo: lança o custo previsto da tarefa direto no Financeiro do
 * evento (saída pendente) e guarda o vínculo — o checklist alimenta o orçamento.
 * Retorna o id da transação criada, ou null se faltou custo ou já estava lançada.
 */
export function logTaskToFinance(taskId: string): string | null {
  let newTxId: string | null = null;
  let amount = 0;
  let title = "";
  let createdTx: Transaction | null = null;
  mutate((s) => {
    const t = s.tasks.find((x) => x.id === taskId);
    if (!t || !t.cost_estimate || t.cost_estimate <= 0 || t.finance_tx_id) return s;
    const id = newId();
    newTxId = id;
    amount = t.cost_estimate;
    title = t.title;
    const tx: Transaction = {
      id,
      event_id: t.event_id,
      category_id: null,
      kind: "saida",
      description: t.title,
      amount: t.cost_estimate,
      payment_status: "pendente",
      invoice_ref: null,
      occurred_on: now().slice(0, 10),
      created_at: now(),
    };
    createdTx = tx;
    return {
      ...s,
      transactions: [tx, ...s.transactions],
      tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, finance_tx_id: id } : x)),
    };
  });
  const w = ws();
  if (w && createdTx && newTxId) {
    sbInsert("transactions", transactionToRow(w, createdTx));
    sbUpdate("tasks", taskId, { finance_tx_id: newTxId });
  }
  if (newTxId) {
    logActivity("💰", ["Tarefa lançada no financeiro · ", fmtMoney(amount), ` · ${title}`]);
  }
  return newTxId;
}

/** Desfaz o vínculo (ex.: a transação ligada foi excluída no Financeiro). */
export function unlinkTaskFinance(taskId: string) {
  mutate((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, finance_tx_id: null } : t)),
  }));
  if (ws()) sbUpdate("tasks", taskId, { finance_tx_id: null });
}

/* ---------- Templates de checklist ---------- */

/** Templates genéricos embutidos (sem nomes/processos de nenhuma empresa). */
export const BUILTIN_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "tpl-online",
    name: "Evento online",
    format: "online",
    builtin: true,
    items: [
      { group: "Alinhamentos", title: "Definir régua de comunicação (e-mail/WhatsApp)", offset_days: -14 },
      { group: "Alinhamentos", title: "Definir plano de social e cobertura", offset_days: -14 },
      { group: "Conteúdo", title: "Tema definido e aprovado", offset_days: -21 },
      { group: "Conteúdo", title: "Pauta estruturada", offset_days: -10 },
      { group: "Conteúdo", title: "Convidado alinhado sobre o roteiro", offset_days: -5 },
      { group: "Técnico", title: "Plataforma de transmissão testada", offset_days: -3 },
      { group: "Técnico", title: "Link de transmissão gerado e compartilhado", offset_days: -2 },
      { group: "Técnico", title: "Teste de áudio e vídeo", offset_days: -1 },
      { group: "Técnico", title: "Pós-live: baixar gravação e gerar clipes", offset_days: 1 },
      { group: "Inscrições", title: "Landing page no ar e funcionando", offset_days: -14 },
      { group: "Inscrições", title: "Meta de inscritos definida", offset_days: -14 },
      { group: "Inscrições", title: "Acompanhamento diário de inscritos", offset_days: -7 },
      { group: "Comunicação", title: "Disparo pré-evento com o link", offset_days: 0 },
      { group: "Comunicação", title: "Disparo durante o evento", offset_days: 0 },
      { group: "Comunicação", title: "Disparo pós-evento (encerramento + CTA)", offset_days: 1 },
      { group: "Pós-evento", title: "Compilar inscritos e leads", offset_days: 1 },
      { group: "Pós-evento", title: "Follow-up definido", offset_days: 2 },
      { group: "Pós-evento", title: "Pesquisa de satisfação (NPS) enviada", offset_days: 2 },
      { group: "Pós-evento", title: "Resultados registrados", offset_days: 3 },
    ],
  },
  {
    id: "tpl-presencial",
    name: "Evento presencial",
    format: "presencial",
    builtin: true,
    items: [
      { group: "Alinhamentos", title: "Definir régua de comunicação (e-mail/WhatsApp)", offset_days: -14 },
      { group: "Alinhamentos", title: "Definir plano de social e cobertura", offset_days: -14 },
      { group: "Apresentação", title: "Apresentação finalizada e aprovada", offset_days: -3 },
      { group: "Apresentação", title: "Arquivo em PDF + backup", offset_days: -2 },
      { group: "Apresentação", title: "Equipamento de projeção confirmado (HDMI/USB-C)", offset_days: -1 },
      { group: "Prospecção", title: "Flyers / cartões com contato do time", offset_days: -7 },
      { group: "Prospecção", title: "QR Code para landing page ou site", offset_days: -7 },
      { group: "Prospecção", title: "Script de abordagem alinhado", offset_days: -3 },
      { group: "Prospecção", title: "Critério de qualificação de lead (ICP) definido", offset_days: -3 },
      { group: "Prospecção", title: "Meta individual de negócios combinada", offset_days: -2 },
      { group: "Prospecção", title: "Ferramenta para registrar leads em tempo real", offset_days: -1 },
      { group: "Branding", title: "Uniforme / camisetas da equipe", offset_days: -5 },
      { group: "Branding", title: "Crachás com nome e cargo", offset_days: -3 },
      { group: "Branding", title: "Banner / rollup (se aplicável)", offset_days: -3 },
      { group: "Branding", title: "Brindes (se aplicável)", offset_days: -5 },
      { group: "Logística", title: "Endereço e horário de chegada combinados", offset_days: -1 },
      { group: "Logística", title: "Credenciamento confirmado", offset_days: -1 },
      { group: "Logística", title: "Distribuição de funções e zonas combinada", offset_days: -1 },
      { group: "Pós-evento", title: "Leads registrados e compilados", offset_days: 1 },
      { group: "Pós-evento", title: "Briefing e responsável de follow-up definidos", offset_days: 2 },
      { group: "Pós-evento", title: "Resultados registrados", offset_days: 3 },
    ],
  },
];

/** Data-only (YYYY-MM-DD) = data do evento + offset; null se faltar base ou offset. */
function dueFromOffset(startsAt: string | undefined, offset: number | undefined): string | null {
  if (!startsAt || offset === undefined) return null;
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fase derivada do prazo relativo: antes = pré, no dia = durante, depois = pós. */
function phaseFromOffset(offset: number | undefined): TaskPhase {
  if (offset === undefined || offset < 0) return "pre";
  return offset === 0 ? "durante" : "pos";
}

/** Offset em dias entre um prazo (data-only) e a data do evento; vazio se faltar algo. */
function offsetFromDue(startsAt: string | undefined, due: string | null): { offset_days?: number } {
  if (!startsAt || !due) return {};
  const start = new Date(startsAt);
  const d = new Date(due + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(d.getTime())) return {};
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  return { offset_days: Math.round((d.getTime() - startDay.getTime()) / 86400000) };
}

/** Aplica um template ao evento: adiciona (sem apagar) as tarefas, com prazos calculados. */
export function applyTemplate(eventId: string, template: ChecklistTemplate): number {
  let count = 0;
  const created: Task[] = [];
  mutate((s) => {
    const ev = s.events.find((e) => e.id === eventId);
    for (const it of template.items) {
      created.push({
        id: newId(),
        event_id: eventId,
        title: it.title,
        group: it.group,
        phase: it.phase ?? phaseFromOffset(it.offset_days),
        status: "aberta",
        assignee_id: null,
        due_date: dueFromOffset(ev?.starts_at, it.offset_days),
        created_at: now(),
      });
    }
    count = created.length;
    return { ...s, tasks: [...created, ...s.tasks] };
  });
  const w = ws();
  if (w && created.length) sbInsert("tasks", created.map((t) => taskToRow(w, t)));
  if (count > 0) {
    logActivity("🧩", ["Template ", template.name, ` aplicado · ${count} tarefas`]);
  }
  return count;
}

/** Salva o checklist atual do evento como template customizado reutilizável. */
export function saveChecklistAsTemplate(eventId: string, name: string): string {
  const id = newId();
  const clean = name.trim();
  let tpl!: ChecklistTemplate;
  mutate((s) => {
    const ev = s.events.find((e) => e.id === eventId);
    const items: ChecklistTemplateItem[] = s.tasks
      .filter((t) => t.event_id === eventId)
      .map((t) => {
        const off = offsetFromDue(ev?.starts_at, t.due_date);
        return {
          group: t.group,
          title: t.title,
          phase: t.phase ?? phaseFromOffset(off.offset_days),
          ...off,
        };
      });
    tpl = { id, name: clean, format: ev?.format, builtin: false, items };
    return { ...s, templates: [tpl, ...s.templates] };
  });
  const w = ws();
  if (w) sbInsert("checklist_templates", templateToRow(w, tpl));
  logActivity("🧩", ["Template ", clean, " salvo"]);
  return id;
}

export function removeTemplate(id: string) {
  mutate((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
  if (ws()) sbDelete("checklist_templates", id);
}

/* ---------- Financeiro ---------- */

export type TransactionDraft = {
  description: string;
  amount: number;
  kind: TxKind;
  category_id: string | null;
  payment_status: TxPayment;
  invoice_ref: string | null;
  invoice_file?: { name: string; data: string } | null;
  boleto_file?: { name: string; data: string } | null;
  occurred_on: string;
};

export function addTransaction(eventId: string, draft: TransactionDraft): string {
  const id = newId();
  const tx: Transaction = { ...draft, id, event_id: eventId, created_at: now() };
  mutate((s) => ({ ...s, transactions: [tx, ...s.transactions] }));
  const w = ws();
  if (w) sbInsert("transactions", transactionToRow(w, tx));
  logActivity("💰", [
    draft.kind === "entrada" ? "Receita de " : "Lançamento de ",
    fmtMoney(draft.amount),
    ` · ${draft.description}`,
  ]);
  return id;
}

/** Edita os campos de um lançamento existente (mesmo draft do form de criação). */
export function updateTransaction(id: string, patch: Partial<TransactionDraft>) {
  mutate((s) => ({
    ...s,
    transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
  if (ws()) sbUpdate("transactions", id, patch as Row);
  logActivity("✏️", ["Lançamento editado", patch.description ? ` · ${patch.description}` : ""]);
}

/** Anexa/troca/remove o arquivo (NF ou boleto) de um lançamento existente. */
export function setTransactionFile(
  id: string,
  field: "invoice_file" | "boleto_file",
  file: { name: string; data: string } | null
) {
  mutate((s) => ({
    ...s,
    transactions: s.transactions.map((t) => (t.id === id ? { ...t, [field]: file } : t)),
  }));
  if (ws()) sbUpdate("transactions", id, { [field]: file });
}

export function removeTransaction(id: string) {
  mutate((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
  if (ws()) sbDelete("transactions", id);
}

export function setBudget(eventId: string, budget: number) {
  mutate((s) => ({
    ...s,
    events: s.events.map((e) => (e.id === eventId ? { ...e, budget_planned: budget } : e)),
  }));
  if (ws()) sbUpdate("events", eventId, { budget_planned: budget });
}

/* ---------- Membros ---------- */

export type MemberDraft = Pick<Member, "name" | "email" | "role" | "title">;

export function addMember(draft: MemberDraft): string {
  const id = newId();
  const member: Member = { ...draft, id, initials: initialsOf(draft.name), created_at: now() };
  mutate((s) => ({ ...s, members: [...s.members, member] }));
  const w = ws();
  if (w) sbInsert("members", memberToRow(w, member));
  logActivity("👥", ["", draft.name, " entrou na organização"]);
  return id;
}

export function removeMember(id: string) {
  mutate((s) => ({
    ...s,
    members: s.members.filter((m) => m.id !== id),
    tasks: s.tasks.map((t) => (t.assignee_id === id ? { ...t, assignee_id: null } : t)),
  }));
  // tasks.assignee_id cai para null por FK on delete set null no banco.
  if (ws()) sbDelete("members", id);
}

/* ---------- Workspace & preferências ---------- */

export function updateWorkspace(patch: Partial<{ name: string; timezone: string }>) {
  mutate((s) => ({ ...s, workspace: { ...s.workspace, ...patch } }));
  const w = ws();
  if (w) sbUpdate("workspaces", w, patch as Row);
}

export function updateProfile(userId: string, patch: Partial<Pick<Member, "name" | "email">>) {
  mutate((s) => ({
    ...s,
    members: s.members.map((m) =>
      m.id === userId
        ? { ...m, ...patch, initials: patch.name ? initialsOf(patch.name) : m.initials }
        : m
    ),
  }));
  if (ws()) {
    const row: Row = { ...patch };
    if (patch.name) row.initials = initialsOf(patch.name);
    sbUpdate("members", userId, row);
  }
}

export function setSymplaToken(token: string | null) {
  mutate((s) => ({ ...s, settings: { ...s.settings, sympla_token: token } }));
  saveSettings();
}

export function setSymplaEventLink(
  eventId: string,
  link: Omit<SymplaEventLink, "linked_at"> & { linked_at?: string } | null
) {
  mutate((s) => {
    const links = { ...(s.settings.sympla_event_links ?? {}) };
    if (!link) delete links[eventId];
    else {
      links[eventId] = {
        ...links[eventId],
        ...link,
        linked_at: link.linked_at ?? links[eventId]?.linked_at ?? now(),
      };
    }
    return { ...s, settings: { ...s.settings, sympla_event_links: links } };
  });
  saveSettings();
}

export function setHubspotToken(token: string | null) {
  mutate((s) => ({ ...s, settings: { ...s.settings, hubspot_token: token } }));
  saveSettings();
}

export function setClickupToken(token: string | null) {
  mutate((s) => ({ ...s, settings: { ...s.settings, clickup_token: token } }));
  saveSettings();
}

export function setSidebarCollapsed(collapsed: boolean) {
  mutate((s) => ({ ...s, settings: { ...s.settings, sidebar_collapsed: collapsed } }));
  saveSettings();
}

/** Define/remove a foto de perfil do membro (data URL comprimido). */
export function setProfilePhoto(userId: string, dataUrl: string | null) {
  mutate((s) => ({
    ...s,
    members: s.members.map((m) => (m.id === userId ? { ...m, avatar: dataUrl } : m)),
  }));
  if (ws()) sbUpdate("members", userId, { avatar: dataUrl });
}

/* ---------- Dashboard customizável ---------- */

/** Aplica uma transformação na config do dashboard (partindo do padrão se vazia). */
function mutateDashboard(fn: (d: DashboardConfig) => DashboardConfig) {
  mutate((s) => ({
    ...s,
    settings: { ...s.settings, dashboard: fn(s.settings.dashboard ?? DEFAULT_DASHBOARD) },
  }));
  saveSettings();
}

export function addDashboardWidget(widget: Omit<DashboardWidget, "id">): string {
  const id = newId();
  mutateDashboard((d) => ({ ...d, widgets: [...d.widgets, { ...widget, id }] }));
  return id;
}

export function removeDashboardWidget(id: string) {
  mutateDashboard((d) => ({ ...d, widgets: d.widgets.filter((w) => w.id !== id) }));
}

export function updateDashboardWidget(id: string, patch: Partial<Omit<DashboardWidget, "id">>) {
  mutateDashboard((d) => ({
    ...d,
    widgets: d.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
  }));
}

/** Reordena os widgets para a ordem de ids dada (drag-and-drop); preserva sobras. */
export function reorderDashboard(orderedIds: string[]) {
  mutateDashboard((d) => {
    const byId = new Map(d.widgets.map((w) => [w.id, w]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((w): w is DashboardWidget => !!w);
    for (const w of d.widgets) if (!orderedIds.includes(w.id)) next.push(w);
    return { ...d, widgets: next };
  });
}

/** Volta o dashboard ao layout padrão. */
export function resetDashboard() {
  mutate((s) => ({ ...s, settings: { ...s.settings, dashboard: null } }));
  saveSettings();
}

export type CustomMetricDraft = Pick<CustomMetric, "label" | "source" | "agg" | "filter" | "format">;

/** Cria uma métrica personalizada e já adiciona um widget KPI para ela. */
export function addCustomMetric(draft: CustomMetricDraft): string {
  const id = newId();
  mutateDashboard((d) => ({
    ...d,
    customMetrics: [...d.customMetrics, { ...draft, id, icon: customMetricIcon(draft.source) }],
    widgets: [...d.widgets, { id: newId(), type: "kpi", metric: id, span: 1 }],
  }));
  return id;
}

export function removeCustomMetric(id: string) {
  mutateDashboard((d) => ({
    ...d,
    customMetrics: d.customMetrics.filter((m) => m.id !== id),
    widgets: d.widgets.filter((w) => !(w.type === "kpi" && w.metric === id)),
  }));
}

/* ---------- Importação de tarefas em lote (ClickUp) ---------- */

export type TaskImportDraft = {
  title: string;
  group: string;
  phase?: TaskPhase;
  due_date?: string | null;
};

/** Importa tarefas para o checklist do evento; deduplica por título. */
export function importTasks(
  eventId: string,
  drafts: TaskImportDraft[]
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  const fresh: Task[] = [];
  mutate((s) => {
    const seen = new Set(
      s.tasks.filter((t) => t.event_id === eventId).map((t) => t.title.trim().toLowerCase())
    );
    for (const d of drafts) {
      const key = d.title.trim().toLowerCase();
      if (!key || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      fresh.push({
        id: newId(),
        event_id: eventId,
        title: d.title,
        group: d.group,
        // sem fase explícita a view deriva do prazo (phaseOf) vs. data do evento
        phase: d.phase,
        status: "aberta",
        assignee_id: null,
        due_date: d.due_date ?? null,
        created_at: now(),
      });
      added++;
    }
    return fresh.length ? { ...s, tasks: [...fresh, ...s.tasks] } : s;
  });
  const w = ws();
  if (w && fresh.length) sbInsert("tasks", fresh.map((t) => taskToRow(w, t)));
  if (added > 0) {
    logActivity("🧩", ["", `${added} tarefa${added === 1 ? "" : "s"}`, " importada(s) do ClickUp"]);
  }
  return { added, skipped };
}

/* ---------- Buscas recentes (overlay de busca global) ---------- */

export function pushRecentSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  mutate((s) => {
    const rest = (s.settings.recent_searches ?? []).filter(
      (x) => x.toLowerCase() !== t.toLowerCase()
    );
    return {
      ...s,
      settings: { ...s.settings, recent_searches: [t, ...rest].slice(0, 8) },
    };
  });
  saveSettings();
}

export function clearRecentSearches() {
  mutate((s) => ({ ...s, settings: { ...s.settings, recent_searches: [] } }));
  saveSettings();
}

/* ---------- Notas do calendário (por dia) ---------- */

/** Define (ou remove, se vazia) a nota de um dia. `date` no formato YYYY-MM-DD. */
export function setDayNote(date: string, text: string) {
  const clean = text.trim();
  mutate((s) => {
    const notes = { ...(s.settings.day_notes ?? {}) };
    if (clean) notes[date] = clean;
    else delete notes[date];
    return { ...s, settings: { ...s.settings, day_notes: notes } };
  });
  saveSettings();
}

export function setToggle(key: string, value: boolean) {
  mutate((s) => ({
    ...s,
    settings: { ...s.settings, toggles: { ...s.settings.toggles, [key]: value } },
  }));
  saveSettings();
}
