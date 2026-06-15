// Mutações da camada de dados — uma função por operação, espelhando o que
// virarão Server Actions/queries Supabase. A UI só importa de @/lib/db.

import type {
  Attendee,
  AttendeeStatus,
  ChecklistTemplate,
  ChecklistTemplateItem,
  CustomMetric,
  DashboardConfig,
  DashboardWidget,
  Event,
  EventFormat,
  EventPriority,
  Member,
  MemberRole,
  Task,
  TaskAttachment,
  TaskPhase,
  TicketType,
  Transaction,
  TxKind,
  TxPayment,
} from "@/types";
import { initialsOf, fmtMoney } from "@/lib/format";
import { endSession, mutate, newId, switchUser } from "./store";
import { DEFAULT_DASHBOARD, customMetricIcon } from "./derived";

const now = () => new Date().toISOString();

function logActivity(icon: string, text: string[]) {
  mutate((s) => ({
    ...s,
    activity: [
      { id: newId(), icon, text, created_at: now() },
      ...s.activity,
    ].slice(0, 50),
  }));
}

/* ---------- Sessão ---------- */

/**
 * Login demo: carrega (ou cria) a base deste email no navegador e o usuário
 * assume o perfil de owner do workspace dela.
 */
export function login(name: string, email: string) {
  switchUser(email);
  mutate((s) => {
    const owner = s.members.find((m) => m.role === "owner");
    const ownerId = owner?.id ?? newId();
    const members = owner
      ? s.members.map((m) =>
          m.id === ownerId ? { ...m, name, email, initials: initialsOf(name) } : m
        )
      : [
          {
            id: ownerId, name, email, initials: initialsOf(name),
            role: "owner" as MemberRole, title: "Produtor", created_at: now(),
          },
          ...s.members,
        ];
    return { ...s, members, session: { ...s.session, user_id: ownerId } };
  });
}

export function logout() {
  // grava a base do usuário com a sessão fechada e libera o navegador
  endSession();
}

export function selectEvent(eventId: string) {
  mutate((s) => ({ ...s, session: { ...s.session, selected_event_id: eventId } }));
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
  mutate((s) => ({
    ...s,
    events: [
      {
        ...draft,
        id,
        cover: draft.cover ?? EVENT_COVERS[s.events.length % EVENT_COVERS.length].css,
        created_at: now(),
      },
      ...s.events,
    ],
    session: { ...s.session, selected_event_id: id },
  }));
  logActivity("🗓️", ["Evento ", draft.name, " criado"]);
  return id;
}

export function updateEvent(id: string, patch: Partial<EventDraft>) {
  mutate((s) => ({
    ...s,
    events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

export function deleteEvent(id: string) {
  mutate((s) => {
    const events = s.events.filter((e) => e.id !== id);
    const selected =
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
    };
  });
}

/* ---------- Inscritos ---------- */

export type AttendeeDraft = Pick<Attendee, "name" | "email" | "company"> & {
  ticket: TicketType;
  status: AttendeeStatus;
};

export function addAttendee(eventId: string, draft: AttendeeDraft): string {
  const id = newId();
  mutate((s) => ({
    ...s,
    attendees: [{ ...draft, id, event_id: eventId, created_at: now() }, ...s.attendees],
  }));
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
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  mutate((s) => {
    const seen = new Set(
      s.attendees.filter((a) => a.event_id === eventId).map((a) => a.email.toLowerCase())
    );
    const fresh: Attendee[] = [];
    for (const d of drafts) {
      const key = d.email.trim().toLowerCase();
      if (!key || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      fresh.push({ ...d, id: newId(), event_id: eventId, created_at: now() });
      added++;
    }
    return fresh.length ? { ...s, attendees: [...fresh, ...s.attendees] } : s;
  });
  if (added > 0) {
    logActivity("📥", ["", `${added} inscrito${added === 1 ? "" : "s"}`, " importados para o evento"]);
  }
  return { added, skipped };
}

export function removeAttendee(id: string) {
  mutate((s) => ({ ...s, attendees: s.attendees.filter((a) => a.id !== id) }));
}

/* ---------- Checklist ---------- */

export type TaskDraft = Pick<Task, "title" | "group" | "phase" | "assignee_id" | "due_date">;

export function addTask(eventId: string, draft: TaskDraft): string {
  const id = newId();
  mutate((s) => ({
    ...s,
    tasks: [
      { ...draft, id, event_id: eventId, status: "aberta", created_at: now() },
      ...s.tasks,
    ],
  }));
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
  if (nowDone) logActivity("✅", ["Tarefa ", `“${title}”`, " concluída"]);
}

export function removeTask(id: string) {
  mutate((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
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
    return {
      ...s,
      transactions: [tx, ...s.transactions],
      tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, finance_tx_id: id } : x)),
    };
  });
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
  mutate((s) => {
    const ev = s.events.find((e) => e.id === eventId);
    const created = template.items.map((it): Task => ({
      id: newId(),
      event_id: eventId,
      title: it.title,
      group: it.group,
      phase: it.phase ?? phaseFromOffset(it.offset_days),
      status: "aberta",
      assignee_id: null,
      due_date: dueFromOffset(ev?.starts_at, it.offset_days),
      created_at: now(),
    }));
    count = created.length;
    return { ...s, tasks: [...created, ...s.tasks] };
  });
  if (count > 0) {
    logActivity("🧩", ["Template ", template.name, ` aplicado · ${count} tarefas`]);
  }
  return count;
}

/** Salva o checklist atual do evento como template customizado reutilizável. */
export function saveChecklistAsTemplate(eventId: string, name: string): string {
  const id = newId();
  const clean = name.trim();
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
    const tpl: ChecklistTemplate = { id, name: clean, format: ev?.format, builtin: false, items };
    return { ...s, templates: [tpl, ...s.templates] };
  });
  logActivity("🧩", ["Template ", clean, " salvo"]);
  return id;
}

export function removeTemplate(id: string) {
  mutate((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
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
  mutate((s) => ({
    ...s,
    transactions: [{ ...draft, id, event_id: eventId, created_at: now() }, ...s.transactions],
  }));
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
}

export function removeTransaction(id: string) {
  mutate((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
}

export function setBudget(eventId: string, budget: number) {
  mutate((s) => ({
    ...s,
    events: s.events.map((e) => (e.id === eventId ? { ...e, budget_planned: budget } : e)),
  }));
}

/* ---------- Membros ---------- */

export type MemberDraft = Pick<Member, "name" | "email" | "role" | "title">;

export function addMember(draft: MemberDraft): string {
  const id = newId();
  mutate((s) => ({
    ...s,
    members: [...s.members, { ...draft, id, initials: initialsOf(draft.name), created_at: now() }],
  }));
  logActivity("👥", ["", draft.name, " entrou na organização"]);
  return id;
}

export function removeMember(id: string) {
  mutate((s) => ({
    ...s,
    members: s.members.filter((m) => m.id !== id),
    tasks: s.tasks.map((t) => (t.assignee_id === id ? { ...t, assignee_id: null } : t)),
  }));
}

/* ---------- Workspace & preferências ---------- */

export function updateWorkspace(patch: Partial<{ name: string; timezone: string }>) {
  mutate((s) => ({ ...s, workspace: { ...s.workspace, ...patch } }));
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
}

export function setSymplaToken(token: string | null) {
  mutate((s) => ({ ...s, settings: { ...s.settings, sympla_token: token } }));
}

export function setHubspotToken(token: string | null) {
  mutate((s) => ({ ...s, settings: { ...s.settings, hubspot_token: token } }));
}

export function setClickupToken(token: string | null) {
  mutate((s) => ({ ...s, settings: { ...s.settings, clickup_token: token } }));
}

export function setSidebarCollapsed(collapsed: boolean) {
  mutate((s) => ({ ...s, settings: { ...s.settings, sidebar_collapsed: collapsed } }));
}

/** Define/remove a foto de perfil do membro (data URL comprimido). */
export function setProfilePhoto(userId: string, dataUrl: string | null) {
  mutate((s) => ({
    ...s,
    members: s.members.map((m) => (m.id === userId ? { ...m, avatar: dataUrl } : m)),
  }));
}

/* ---------- Dashboard customizável ---------- */

/** Aplica uma transformação na config do dashboard (partindo do padrão se vazia). */
function mutateDashboard(fn: (d: DashboardConfig) => DashboardConfig) {
  mutate((s) => ({
    ...s,
    settings: { ...s.settings, dashboard: fn(s.settings.dashboard ?? DEFAULT_DASHBOARD) },
  }));
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
  mutate((s) => {
    const seen = new Set(
      s.tasks.filter((t) => t.event_id === eventId).map((t) => t.title.trim().toLowerCase())
    );
    const fresh: Task[] = [];
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
}

export function clearRecentSearches() {
  mutate((s) => ({ ...s, settings: { ...s.settings, recent_searches: [] } }));
}

export function setToggle(key: string, value: boolean) {
  mutate((s) => ({
    ...s,
    settings: { ...s.settings, toggles: { ...s.settings.toggles, [key]: value } },
  }));
}
