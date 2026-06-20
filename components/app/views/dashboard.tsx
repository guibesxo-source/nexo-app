"use client";

/* Dashboard do evento — agora customizável (FR pós-MVP): grade de widgets que
   o usuário adiciona/remove/reordena/redimensiona; KPIs do catálogo + métricas
   personalizadas + blocos (gráficos e listas). O layout vive em
   settings.dashboard (cai no DEFAULT_DASHBOARD quando vazio). */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BarChart, Card, Donut, Empty, Field, Icon, Kpi, Modal, PageHead, useToast,
} from "@/components/app/kit";
import { CostPanel } from "@/components/app/cost-panel";
import { useGo, useUi } from "@/components/app/shell";
import { ImportAttendeesModal } from "@/components/app/import-attendees";
import { useSymplaAutoSync } from "@/components/app/sympla-sync";
import {
  addCustomMetric,
  addDashboardWidget,
  catalogMetric,
  categoryTotals,
  customMetricValue,
  dynamicDashboard,
  dynamicHighlights,
  eventById,
  eventInsights,
  eventKpis,
  firstSignupDate,
  formatMetricValue,
  leadBreakdown,
  leadSegmentFields,
  METRIC_CATALOG,
  metricInsight,
  removeCustomMetric,
  setDashboardLeadBreakdowns,
  removeDashboardWidget,
  reorderDashboard,
  resetDashboard,
  selectedEvent,
  signupsByDate,
  signupsPerDay,
  updateDashboardWidget,
  useDb,
  type EventKpis,
} from "@/lib/db";
import { daysUntil, fmtMoney, relTime } from "@/lib/format";
import type {
  Activity,
  CustomMetricAgg,
  CustomMetricSource,
  DashboardConfig,
  DashboardWidget,
  DashboardWidgetType,
} from "@/types";

/* ---------- catálogos auxiliares ---------- */

const BLOCKS: { type: DashboardWidgetType; label: string; icon: string; desc: string }[] = [
  { type: "chart-signups", label: "Inscritos por data", icon: "trending", desc: "Gráfico de novas inscrições" },
  { type: "chart-confirm", label: "Confirmação", icon: "users", desc: "Donut de confirmados x pendentes" },
  { type: "chart-category", label: "Gastos por categoria", icon: "wallet", desc: "Ranking de despesas do evento" },
  { type: "block-cost", label: "Custo por inscrito", icon: "wallet", desc: "Custo, receita e resultado por inscrito" },
  { type: "list-insights", label: "Insights do evento", icon: "bolt", desc: "Alertas que mudam com a performance" },
  { type: "list-activity", label: "Atividade recente", icon: "bell", desc: "Últimas ações do workspace" },
  { type: "list-progress", label: "Progresso por área", icon: "checkSquare", desc: "Captação, orçamento, checklist" },
];

const FILTERS: Record<CustomMetricSource, { v: string; l: string }[]> = {
  inscritos: [
    { v: "todos", l: "Todos os inscritos" },
    { v: "confirmado", l: "Confirmados" },
    { v: "pendente", l: "Pendentes" },
    { v: "checkin", l: "Check-ins" },
  ],
  financeiro: [
    { v: "todos", l: "Todas as transações" },
    { v: "entrada", l: "Receitas" },
    { v: "saida", l: "Saídas" },
  ],
  checklist: [
    { v: "todas", l: "Todas as tarefas" },
    { v: "aberta", l: "Abertas" },
    { v: "concluida", l: "Concluídas" },
    { v: "atrasada", l: "Atrasadas" },
  ],
};

const defaultFilter = (s: CustomMetricSource) => (s === "checklist" ? "todas" : "todos");

/** Atributos de lead priorizados como cards de segmentação por padrão. */
const DEFAULT_BREAKDOWN_KEYS = [
  "hubspot:tamanho_frota",
  "hubspot:cargo",
  "hubspot:utm_source",
  "hubspot:audience",
  "hubspot:location",
  "hubspot:utm_content",
];

/** Atalhos de período do gráfico de inscritos (janela terminando hoje). */
const SIGNUP_PRESETS: { label: string; days: number }[] = [
  { label: "1 semana", days: 7 },
  { label: "1 mês", days: 30 },
  { label: "3 meses", days: 90 },
];

const dateOnly = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

/** Dias (inclusivo) entre duas datas YYYY-MM-DD; base da média/dia honesta. */
const daysInclusive = (from: string, to: string) => {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

function dashboardColumns(width: number): number {
  if (width < 620) return 1;
  if (width < 900) return 2;
  if (width < 1180) return 3;
  return 4;
}

function defaultWidgetSpan(type: DashboardWidgetType): number {
  if (type === "kpi") return 1;
  if (type === "chart-confirm") return 1;
  if (type === "chart-signups") return 3;
  return 2;
}

const isKpiWidget = (w: DashboardWidget) => w.type === "kpi";

/** Largura base do widget (1–cols), partindo da configurada ou do padrão. */
const widgetBaseSpan = (w: DashboardWidget, cols: number) =>
  Math.min(cols, Math.max(1, w.span ?? defaultWidgetSpan(w.type)));

/** Próxima largura ao clicar no controle: KPI alterna ¼↔½; blocos ½→¾→1→½. */
function nextWidgetSpan(w: DashboardWidget): number {
  const cur = w.span ?? defaultWidgetSpan(w.type);
  if (isKpiWidget(w)) return cur >= 2 ? 1 : 2;
  return cur >= 4 ? 2 : cur + 1;
}

const SPAN_LABEL: Record<number, string> = { 1: "¼", 2: "½", 3: "¾", 4: "1" };

/**
 * Distribui os widgets numa grade de `cols` colunas SEMPRE preenchendo cada
 * linha por inteiro (sem buracos) e com resultado idêntico em edição e
 * visualização (WYSIWYG — o que você dimensiona é o que aparece). KPIs e blocos
 * não dividem a mesma linha (alturas muito diferentes deixavam KPIs gigantes ou
 * vazios) e KPIs ficam no máximo com 2 colunas, exceto quando sozinhos na linha.
 */
function layoutWidgets(widgets: DashboardWidget[], cols: number): { widget: DashboardWidget; span: number }[] {
  const items = widgets.map((w) => ({ widget: w, base: widgetBaseSpan(w, cols), kpi: isKpiWidget(w) }));
  const out: { widget: DashboardWidget; span: number }[] = [];
  let row: typeof items = [];

  const flush = () => {
    if (!row.length) return;
    const spans = row.map((it) => it.base);
    const cap = (i: number) => (row[i].kpi && row.length > 1 ? 2 : cols);
    let leftover = cols - spans.reduce((a, b) => a + b, 0);
    let guard = cols * row.length + 1;
    while (leftover > 0 && guard-- > 0) {
      let changed = false;
      for (let i = 0; i < row.length && leftover > 0; i++) {
        if (spans[i] < cap(i)) {
          spans[i] += 1;
          leftover -= 1;
          changed = true;
        }
      }
      if (!changed) break;
    }
    row.forEach((it, i) => out.push({ widget: it.widget, span: spans[i] }));
    row = [];
  };

  let used = 0;
  for (const it of items) {
    const kindBreak = row.length > 0 && row[0].kpi !== it.kpi;
    if (kindBreak || (row.length > 0 && used + it.base > cols)) {
      flush();
      used = 0;
    }
    row.push(it);
    used += it.base;
    if (used >= cols) {
      flush();
      used = 0;
    }
  }
  flush();
  return out;
}

/** Agrupa atividades CONSECUTIVAS de mesmo ícone+texto numa só linha (com
   contagem), mantendo o horário mais recente — colapsa o eco do sync automático
   que já está no histórico, sem perder as ações distintas. */
function groupActivity(items: Activity[]): (Activity & { count: number })[] {
  const out: (Activity & { count: number })[] = [];
  const sig = (a: Activity) => a.icon + "|" + a.text.join(" ");
  for (const a of items) {
    const last = out[out.length - 1];
    if (last && sig(last) === sig(a)) last.count += 1;
    else out.push({ ...a, count: 1 });
  }
  return out;
}

/* ---------- navegação: cada widget aponta p/ a tela da sua fonte de dados ---------- */
const METRIC_DEST: Record<string, string> = {
  total: "inscritos", confirmed: "inscritos", pending: "inscritos", checkin: "inscritos",
  confirmRate: "inscritos", neededPerDay: "inscritos",
  income: "financeiro", spent: "financeiro", available: "financeiro", budgetPct: "financeiro",
  costPerAttendee: "financeiro", costPerConfirmed: "financeiro",
  revenuePerAttendee: "financeiro", resultPerAttendee: "financeiro",
  tasksDone: "checklist", tasksLate: "checklist",
};
const DEST_LABEL: Record<string, string> = {
  inscritos: "Inscritos", financeiro: "Financeiro", checklist: "Checklist",
};

/** Tela de destino de uma métrica (catálogo ou personalizada). */
function destForMetric(key: string, cfg: DashboardConfig): string | null {
  if (METRIC_DEST[key]) return METRIC_DEST[key];
  const cm = cfg.customMetrics.find((m) => m.id === key);
  return cm ? cm.source : null;
}

/** Tela de destino de um widget (KPI → fonte da métrica; blocos → sua área). */
function destForWidget(w: DashboardWidget, cfg: DashboardConfig): string | null {
  switch (w.type) {
    case "kpi": return destForMetric(w.metric ?? "", cfg);
    case "chart-signups":
    case "chart-confirm": return "inscritos";
    case "chart-category":
    case "block-cost": return "financeiro";
    case "list-progress": return "checklist";
    default: return null;
  }
}

/** Move dragId para a posição de overId, devolvendo a nova ordem de ids. */
function reorderIds(ids: string[], dragId: string, overId: string): string[] {
  if (dragId === overId) return ids;
  const without = ids.filter((id) => id !== dragId);
  const idx = without.indexOf(overId);
  if (idx === -1) return ids;
  without.splice(idx, 0, dragId);
  return without;
}

/* ---------- modal: adicionar widget ---------- */

function AddWidgetModal({ eventId, cfg, k, onClose }: {
  eventId: string;
  cfg: DashboardConfig;
  k: EventKpis;
  onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [tab, setTab] = useState<"kpi" | "blocks" | "custom">("kpi");
  const [form, setForm] = useState<{
    label: string; source: CustomMetricSource; agg: CustomMetricAgg; filter: string;
  }>({ label: "", source: "inscritos", agg: "count", filter: "todos" });

  const addKpi = (metric: string) => {
    addDashboardWidget({ type: "kpi", metric, span: 1 });
    toast("KPI adicionado ao dashboard");
  };
  const addBlock = (type: DashboardWidgetType) => {
    addDashboardWidget({ type, span: 2 });
    toast("Widget adicionado");
    onClose();
  };

  const previewFormat = form.source === "financeiro" && form.agg === "sum" ? "money" : "number";
  const previewValue = formatMetricValue(
    customMetricValue(db, eventId, {
      id: "_preview", label: form.label, source: form.source, agg: form.agg, filter: form.filter, format: previewFormat,
    }),
    previewFormat
  );

  const createCustom = () => {
    if (!form.label.trim()) {
      toast("Dê um nome para a métrica");
      return;
    }
    addCustomMetric({
      label: form.label.trim(),
      source: form.source,
      agg: form.agg,
      filter: form.filter,
      format: previewFormat,
    });
    toast("Métrica criada e adicionada");
    onClose();
  };

  return (
    <Modal
      title="Adicionar widget"
      onClose={onClose}
      width={640}
      footer={<button className="btn" onClick={onClose}>Concluir</button>}
    >
      <div className="row" style={{ gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        <button className={"chip" + (tab === "kpi" ? " active" : "")} onClick={() => setTab("kpi")}>KPIs</button>
        <button className={"chip" + (tab === "blocks" ? " active" : "")} onClick={() => setTab("blocks")}>Gráficos & listas</button>
        <button className={"chip" + (tab === "custom" ? " active" : "")} onClick={() => setTab("custom")}>Métrica personalizada</button>
      </div>

      {tab === "kpi" && (
        <>
          <div className="aw-grid">
            {METRIC_CATALOG.map((m) => (
              <button key={m.key} className="aw-item" onClick={() => addKpi(m.key)}>
                <span className="aw-ic"><Icon name={m.icon} size={17} /></span>
                <span className="aw-meta">
                  <span className="aw-nm">{m.label}</span>
                  <span className="aw-val">{formatMetricValue(m.value(k), m.format)} · clique para adicionar</span>
                </span>
                <Icon name="plus" size={15} />
              </button>
            ))}
          </div>

          {cfg.customMetrics.length > 0 && (
            <>
              <div className="integ-section" style={{ marginTop: 22 }}>Suas métricas</div>
              <div className="aw-grid">
                {cfg.customMetrics.map((m) => (
                  <div key={m.id} className="aw-item">
                    <span className="aw-ic"><Icon name={m.icon ?? "sparkle"} size={17} /></span>
                    <span className="aw-meta">
                      <span className="aw-nm">{m.label}</span>
                      <span className="aw-val">
                        {formatMetricValue(customMetricValue(db, eventId, m), m.format ?? "number")}
                      </span>
                    </span>
                    <button className="row-action" title="Adicionar de novo" onClick={() => addKpi(m.id)}>
                      <Icon name="plus" size={15} />
                    </button>
                    <button
                      className="row-action danger aw-del"
                      title="Excluir métrica"
                      onClick={() => { removeCustomMetric(m.id); toast("Métrica excluída"); }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "blocks" && (
        <div className="aw-grid">
          {BLOCKS.map((b) => (
            <button key={b.type} className="aw-item" onClick={() => addBlock(b.type)}>
              <span className="aw-ic"><Icon name={b.icon} size={17} /></span>
              <span className="aw-meta">
                <span className="aw-nm">{b.label}</span>
                <span className="aw-val">{b.desc}</span>
              </span>
              <Icon name="plus" size={15} />
            </button>
          ))}
        </div>
      )}

      {tab === "custom" && (
        <>
          <Field label="Nome da métrica">
            <input
              className="input"
              placeholder="Ex.: Leads VIP, Saídas pendentes…"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              autoFocus
            />
          </Field>
          <div className="form-grid">
            <Field label="Base de dados">
              <select
                className="input"
                value={form.source}
                onChange={(e) => {
                  const source = e.target.value as CustomMetricSource;
                  setForm((f) => ({ ...f, source, filter: defaultFilter(source), agg: "count" }));
                }}
              >
                <option value="inscritos">Inscritos</option>
                <option value="financeiro">Financeiro</option>
                <option value="checklist">Checklist</option>
              </select>
            </Field>
            <Field label="Filtro">
              <select
                className="input"
                value={form.filter}
                onChange={(e) => setForm((f) => ({ ...f, filter: e.target.value }))}
              >
                {FILTERS[form.source].map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </Field>
          </div>
          {form.source === "financeiro" && (
            <Field label="Cálculo">
              <select
                className="input"
                value={form.agg}
                onChange={(e) => setForm((f) => ({ ...f, agg: e.target.value as CustomMetricAgg }))}
              >
                <option value="count">Quantidade de lançamentos</option>
                <option value="sum">Soma dos valores (R$)</option>
              </select>
            </Field>
          )}

          <div className="import-summary" style={{ marginTop: 4 }}>
            <Icon name="bolt" size={15} />
            <span>Prévia para este evento: <b>{previewValue}</b></span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-primary" onClick={createCustom}>
              <Icon name="plus" size={15} />Criar e adicionar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- modal: estatísticas laterais de um KPI ---------- */

const MAX_SIDE_METRICS = 3;

function SideMetricsModal({ eventId, cfg, k, widget, onClose }: {
  eventId: string;
  cfg: DashboardConfig;
  k: EventKpis;
  widget: DashboardWidget;
  onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const selected = widget.sideMetrics ?? [];
  const mainKey = widget.metric ?? "";
  const mainLabel =
    catalogMetric(mainKey)?.label ?? cfg.customMetrics.find((m) => m.id === mainKey)?.label ?? "esta métrica";

  // Opções: catálogo + métricas personalizadas, menos a métrica principal do card.
  const options = [
    ...METRIC_CATALOG.map((m) => ({
      key: m.key, label: m.label, icon: m.icon, value: formatMetricValue(m.value(k), m.format),
    })),
    ...cfg.customMetrics.map((m) => ({
      key: m.id, label: m.label, icon: m.icon ?? "sparkle",
      value: formatMetricValue(customMetricValue(db, eventId, m), m.format ?? "number"),
    })),
  ].filter((o) => o.key !== mainKey);

  const toggle = (key: string) => {
    const on = selected.includes(key);
    if (!on && selected.length >= MAX_SIDE_METRICS) {
      toast(`Até ${MAX_SIDE_METRICS} estatísticas na lateral`);
      return;
    }
    const next = on ? selected.filter((s) => s !== key) : [...selected, key];
    const patch: Partial<Omit<DashboardWidget, "id">> = { sideMetrics: next };
    // ao ganhar a primeira lateral, garante largura para o número + as mini stats
    if (next.length > 0 && (widget.span ?? 1) < 2) patch.span = 2;
    updateDashboardWidget(widget.id, patch);
  };

  return (
    <Modal
      title="Estatísticas laterais"
      onClose={onClose}
      width={560}
      footer={<button className="btn btn-primary" onClick={onClose}>Concluir</button>}
    >
      <div className="import-summary" style={{ marginBottom: 16 }}>
        <Icon name="panelLeft" size={15} />
        <span>
          Escolha as mini estatísticas ao lado de <b>{mainLabel}</b> · {selected.length}/{MAX_SIDE_METRICS}
        </span>
      </div>
      <div className="aw-grid">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <button
              key={o.key}
              className={"aw-item" + (on ? " is-on" : "")}
              onClick={() => toggle(o.key)}
            >
              <span className="aw-ic"><Icon name={o.icon} size={17} /></span>
              <span className="aw-meta">
                <span className="aw-nm">{o.label}</span>
                <span className="aw-val">{o.value}</span>
              </span>
              <Icon name={on ? "check" : "plus"} size={15} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ---------- view ---------- */

export function Dashboard({ eventId }: { eventId?: string }) {
  const db = useDb();
  const go = useGo();
  const toast = useToast();
  const { openNewEvent } = useUi();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sideEditId, setSideEditId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [signupFrom, setSignupFrom] = useState("");
  const [signupTo, setSignupTo] = useState("");
  const [signupPickerOpen, setSignupPickerOpen] = useState(false);
  const [cols, setCols] = useState(4);

  const ev = eventId ? eventById(db, eventId) : selectedEvent(db);
  const symplaSync = useSymplaAutoSync(ev?.id ?? null);
  // Sem layout customizado, o dashboard é montado dinamicamente pelo estado do
  // evento (Inscritos central + os melhores KPIs/blocos; oculta o pouco útil).
  const cfg =
    db.settings.dashboard ??
    (ev ? dynamicDashboard(db, ev.id) : { widgets: [], customMetrics: [] });
  // Memoização fica a cargo do React Compiler (sem useMemo manual).
  const responsiveWidgets = layoutWidgets(cfg.widgets, cols);

  useEffect(() => {
    const el = dashboardRef.current;
    if (!el) return;
    const update = () => setCols(dashboardColumns(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ev?.id]);

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Visão geral" sub="Nenhum evento criado ainda" />
        <Empty
          icon="calendar"
          title="Crie seu primeiro evento"
          sub="O dashboard mostra inscritos, orçamento e checklist do evento ativo."
          action={
            <button className="btn btn-primary" onClick={openNewEvent}>
              <Icon name="plus" size={15} />Novo evento
            </button>
          }
        />
      </div>
    );
  }

  const k = eventKpis(db, ev.id);
  const insights = eventInsights(db, ev.id);

  // Destaques dinâmicos: os KPIs mais úteis p/ a performance agora (ranqueados).
  const highlights = dynamicHighlights(db, ev.id);

  // Segmentação de leads: atributos disponíveis + os que o usuário escolheu ver.
  const leadOptions = leadSegmentFields(db, ev.id);
  const defaultBreakdowns = (() => {
    const present = new Set(leadOptions.map((o) => o.key));
    const prio = DEFAULT_BREAKDOWN_KEYS.filter((key) => present.has(key));
    return prio.length ? prio : leadOptions.slice(0, 3).map((o) => o.key);
  })();
  const breakdownPref = db.settings.dashboard_lead_breakdowns;
  const breakdownBase = breakdownPref == null ? defaultBreakdowns : breakdownPref;
  const selectedBreakdowns = breakdownBase.filter((key) => leadOptions.some((o) => o.key === key));
  const toggleBreakdown = (key: string) => {
    const next = breakdownBase.includes(key)
      ? breakdownBase.filter((x) => x !== key)
      : [...breakdownBase, key];
    setDashboardLeadBreakdowns(next);
  };
  const today = dateOnly(new Date());
  const hasSignupFilter = !!signupFrom || !!signupTo;
  // "Desde o início": janela a partir do primeiro inscrito (cai no início do evento).
  const eventStartDate =
    firstSignupDate(db, ev.id) ?? (ev.created_at ? dateOnly(new Date(ev.created_at)) : today);
  const isSinceStart = signupTo === today && signupFrom === eventStartDate;
  // Gráfico: "desde o início" mostra uma barra por dia que teve inscritos (histórico
  // completo, dia a dia); nas outras janelas, o agrupamento automático (dia/semana).
  const signups = isSinceStart
    ? signupsPerDay(db, ev.id, { from: signupFrom, to: signupTo })
    : signupsByDate(db, ev.id, { from: signupFrom || undefined, to: signupTo || undefined, days: 14 });
  const signupToday = signupsByDate(db, ev.id, { from: today, to: today }).reduce((sum, item) => sum + item.v, 0);
  const signupTotal = signups.reduce((sum, item) => sum + item.v, 0);
  // Insights do gráfico: média/dia sobre o nº real de dias da janela (não por
  // barra, p/ ser honesta com buckets semanais ou dias vazios omitidos), o pico
  // do período e a tendência (2ª metade vs 1ª metade da janela visível).
  const signupWindowDays =
    signupFrom && signupTo ? daysInclusive(signupFrom, signupTo)
    : signupFrom ? daysInclusive(signupFrom, today)
    : 14;
  const signupAvg = signupWindowDays > 0 ? signupTotal / signupWindowDays : 0;
  const fmtAvg = signupAvg >= 10
    ? String(Math.round(signupAvg))
    : String(Math.round(signupAvg * 10) / 10).replace(".", ",");
  const signupPeak = signups.reduce((best, d) => (d.v > best.v ? d : best), { l: "", v: 0 });
  const signupHalf = Math.floor(signups.length / 2);
  const signupFirstHalf = signups.slice(0, signupHalf).reduce((s, d) => s + d.v, 0);
  const signupLastHalf = signups.slice(signups.length - signupHalf).reduce((s, d) => s + d.v, 0);
  const signupTrend = signupHalf > 0 && signupFirstHalf > 0
    ? Math.round(((signupLastHalf - signupFirstHalf) / signupFirstHalf) * 100)
    : null;
  // Atalhos de período: definem De/Até como uma janela que termina hoje.
  const applySignupPreset = (rangeDays: number) => {
    const from = new Date(today + "T00:00:00");
    from.setDate(from.getDate() - (rangeDays - 1));
    setSignupFrom(dateOnly(from));
    setSignupTo(today);
    setSignupPickerOpen(false);
  };
  const activeSignupPreset = (() => {
    if (signupTo !== today || !signupFrom) return null;
    const fromMs = new Date(signupFrom + "T00:00:00").getTime();
    const toMs = new Date(today + "T00:00:00").getTime();
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
    return Math.round((toMs - fromMs) / 86400000) + 1;
  })();
  const applySinceStart = () => {
    setSignupFrom(eventStartDate);
    setSignupTo(today);
    setSignupPickerOpen(false);
  };
  const cats = categoryTotals(db, ev.id);
  const days = daysUntil(ev.starts_at);
  const checklistPct = k.tasksTotal ? Math.round((k.tasksDone / k.tasksTotal) * 100) : 0;
  const capacityPct = ev.capacity ? Math.min(100, Math.round((k.total / ev.capacity) * 100)) : 0;
  const progress = [
    { nm: "Captação de inscritos", v: capacityPct },
    { nm: "Orçamento executado", v: Math.min(100, k.budgetPct) },
    { nm: "Checklist de produção", v: checklistPct },
    { nm: "Taxa de confirmação", v: k.confirmRate },
  ];
  const syncSub = symplaSync.link
    ? `Sympla ${symplaSync.busy ? "sincronizando..." : symplaSync.link.last_sync_at ? `sincronizado ${relTime(symplaSync.link.last_sync_at)}` : "vinculado"} · ${k.total} inscritos`
    : `Atualizado agora · ${db.members.length} membros na organização`;

  const ids = cfg.widgets.map((w) => w.id);
  const onDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) reorderDashboard(reorderIds(ids, dragId, targetId));
    setDragId(null);
    setOverId(null);
  };

  /** Resolve qualquer chave de métrica (catálogo ou custom) em dados de exibição. */
  const resolveMetric = (key: string) => {
    const cat = catalogMetric(key);
    if (cat) {
      return { icon: cat.icon, tone: cat.tone, label: cat.label, value: formatMetricValue(cat.value(k), cat.format) };
    }
    const cm = cfg.customMetrics.find((m) => m.id === key);
    if (cm) {
      return {
        icon: cm.icon ?? "sparkle", tone: undefined as string | undefined, label: cm.label,
        value: formatMetricValue(customMetricValue(db, ev.id, cm), cm.format ?? "number"),
      };
    }
    return null;
  };

  const resolveKpi = (w: DashboardWidget) =>
    resolveMetric(w.metric ?? "") ??
    { icon: "sparkle", tone: undefined as string | undefined, label: "Métrica removida", value: "—" };

  const renderWidget = (w: DashboardWidget) => {
    // Fora do modo edição, cada widget leva à tela da sua fonte de dados.
    const dest = editing ? null : destForWidget(w, cfg);
    const navLink = dest ? { label: `Abrir ${DEST_LABEL[dest] ?? "tela"}`, go: () => go(dest) } : null;
    switch (w.type) {
      case "kpi": {
        const r = resolveKpi(w);
        const side = (w.sideMetrics ?? [])
          .map((key) => resolveMetric(key))
          .filter((m): m is NonNullable<typeof m> => !!m)
          .map((m) => ({ icon: m.icon, tone: m.tone, value: m.value, label: m.label }));
        const foot = w.metric ? metricInsight(w.metric, k, ev) : null;
        return (
          <Kpi
            icon={r.icon} iconTone={r.tone} value={r.value} label={r.label}
            side={side} foot={foot ?? undefined}
            onClick={navLink ? navLink.go : undefined}
          />
        );
      }
      case "chart-signups":
        return (
          <Card
            title="Inscritos por data"
            link={navLink?.label}
            onLink={navLink?.go}
            actions={
              <div className="dash-calendar-wrap">
                <button
                  type="button"
                  className={"dash-calendar-btn" + (hasSignupFilter ? " active" : "")}
                  title="Filtrar periodo"
                  aria-label="Filtrar periodo"
                  aria-expanded={signupPickerOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSignupPickerOpen((open) => !open);
                  }}
                >
                  <Icon name="calendar" size={15} />
                </button>
                {signupPickerOpen && (
                  <>
                    <span className="dash-calendar-scrim" onClick={() => setSignupPickerOpen(false)} />
                    <div className="dash-calendar-pop" onClick={(e) => e.stopPropagation()}>
                      <div className="dash-calendar-presets">
                        {SIGNUP_PRESETS.map((p) => (
                          <button
                            key={p.days}
                            type="button"
                            className={"chip" + (!isSinceStart && activeSignupPreset === p.days ? " active" : "")}
                            onClick={() => applySignupPreset(p.days)}
                          >
                            {p.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={"chip" + (isSinceStart ? " active" : "")}
                          onClick={applySinceStart}
                        >
                          Desde o início
                        </button>
                      </div>
                      <label className="dash-date-field">
                        <span>De</span>
                        <input
                          className="input"
                          type="date"
                          value={signupFrom}
                          onChange={(e) => setSignupFrom(e.target.value)}
                        />
                      </label>
                      <label className="dash-date-field">
                        <span>Ate</span>
                        <input
                          className="input"
                          type="date"
                          value={signupTo}
                          onChange={(e) => setSignupTo(e.target.value)}
                        />
                      </label>
                      <div className="dash-calendar-actions">
                        {hasSignupFilter && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setSignupFrom("");
                              setSignupTo("");
                            }}
                          >
                            Limpar
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setSignupPickerOpen(false)}
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            }
          >
            <div className="dash-chart-meta">
              <div className="dash-chart-total">
                <b>{signupToday}</b> hoje · <b>{signupTotal}</b> no período
              </div>
              <div className="dash-chart-total">Média <b>{fmtAvg}</b>/dia</div>
              {signupPeak.v > 0 && (
                <div className="dash-chart-total">Pico <b>{signupPeak.v}</b> · {signupPeak.l}</div>
              )}
              {signupTrend !== null && signupTrend !== 0 && (
                <div
                  className={"dash-chart-trend " + (signupTrend > 0 ? "up" : "down")}
                  title="Tendência: 2ª metade do período comparada com a 1ª metade"
                >
                  <Icon name={signupTrend > 0 ? "arrowUp" : "arrowDown"} size={12} />
                  {Math.abs(signupTrend)}% <span className="dash-chart-trend-sub">no período</span>
                </div>
              )}
              {k.goal > 0 && (
                <div
                  className={
                    "dash-chart-goal" +
                    (k.remainingSeats <= 0 ? " ok" : k.neededPerDay <= 0 ? " warn" : "")
                  }
                  title={`Meta de ${k.goal} inscritos`}
                >
                  <Icon name="trending" size={13} />
                  {k.remainingSeats <= 0 ? (
                    <span>Meta de {k.goal} atingida</span>
                  ) : k.neededPerDay > 0 ? (
                    <span><b>{k.neededPerDay}</b>/dia p/ meta · {k.remainingSeats} em {k.daysToEvent}d</span>
                  ) : (
                    <span>Faltam {k.remainingSeats} p/ meta</span>
                  )}
                </div>
              )}
            </div>
            <BarChart data={signups} />
          </Card>
        );
      case "chart-confirm": {
        const presenceRate = k.confirmed > 0 ? Math.round((k.checkin / k.confirmed) * 100) : 0;
        const confStats: { ic: string; label: string; value: string; tone?: string }[] = [
          { ic: "users", label: "Inscritos", value: String(k.total) },
          { ic: "ticket", label: "Check-in", value: String(k.checkin) },
          { ic: "trending", label: "Presença", value: presenceRate + "%", tone: presenceRate >= 50 ? "pos" : undefined },
          k.goal > 0
            ? { ic: "bolt", label: "Faltam p/ meta", value: String(k.remainingSeats) }
            : { ic: "clock", label: "Pendentes", value: String(k.pending) },
        ];
        return (
          <Card title="Confirmação" link={navLink?.label} onLink={navLink?.go}>
            <div className="confirm-widget">
              <div className="donut-wrap">
                <Donut
                  pct={k.confirmRate}
                  label="conf."
                  legend={[
                    { color: "var(--green)", label: "Confirmados", value: String(k.confirmed) },
                    { color: "#E8E8E5", label: "Pendentes", value: String(k.pending) },
                  ]}
                />
              </div>
              <div className="confirm-stats">
                {confStats.map((s, i) => (
                  <div className="confirm-stat" key={i}>
                    <span className="confirm-stat-ic"><Icon name={s.ic} size={15} /></span>
                    <span className="confirm-stat-meta">
                      <span className={"confirm-stat-v" + (s.tone === "pos" ? " pos" : "")}>{s.value}</span>
                      <span className="confirm-stat-l">{s.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      }
      case "block-cost":
        return (
          <Card title="Custo por inscrito" link={navLink?.label} onLink={navLink?.go}>
            <CostPanel k={k} capacity={ev.capacity} />
          </Card>
        );
      case "list-insights":
        return (
          <Card title="Insights do evento">
            {insights.length === 0 ? (
              <Empty icon="bolt" title="Sem destaques agora" sub="Os alertas de performance aparecem aqui conforme o evento avança." />
            ) : (
              <div className="insights">
                {insights.map((it, i) => (
                  <div className="insight-row" key={i}>
                    <span className={"insight-ic " + it.tone}><Icon name={it.icon} size={15} /></span>
                    <span className="insight-tx">{it.text}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      case "chart-category":
        return (
          <Card title="Gastos por categoria" link={navLink?.label} onLink={navLink?.go}>
            {cats.length === 0 ? (
              <Empty icon="wallet" title="Sem lançamentos" sub="As despesas do evento aparecem aqui." />
            ) : (
              <div className="cat-list">
                {cats.slice(0, 6).map((c) => (
                  <div className="cat-row" key={c.id}>
                    <span className="cat-nm">{c.name}</span>
                    <span className="cat-bar"><i style={{ width: c.pct + "%" }} /></span>
                    <span className="cat-vl">{fmtMoney(c.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      case "list-activity": {
        const grouped = groupActivity(db.activity);
        const nowMs = new Date().getTime();
        const actions24h = db.activity.filter(
          (a) => nowMs - new Date(a.created_at).getTime() < 86400000
        ).length;
        const lastSync = symplaSync.link?.last_sync_at;
        return (
          <Card title="Atividade recente">
            <div className="act-insights">
              <div className="act-insight">
                <span className="act-insight-v">{signupToday}</span>
                <span className="act-insight-l">novos hoje</span>
              </div>
              <div className="act-insight">
                <span className="act-insight-v">{actions24h}</span>
                <span className="act-insight-l">ações em 24h</span>
              </div>
              <div className="act-insight">
                <span className="act-insight-v">{lastSync ? relTime(lastSync).replace(/^há /, "") : "—"}</span>
                <span className="act-insight-l">desde a sync</span>
              </div>
            </div>
            {grouped.length === 0 ? (
              <Empty icon="bolt" title="Sem atividade ainda" sub="As ações da equipe aparecem aqui." />
            ) : (
              <div className="activity">
                {grouped.slice(0, 5).map((a) => (
                  <div className="act-row" key={a.id}>
                    <span className="act-ic">{a.icon}</span>
                    <div className="act-body">
                      <div className="act-txt">
                        {a.text.map((s, j) => (j % 2 ? <b key={j}>{s}</b> : s))}
                        {a.count > 1 && <span className="act-count">{a.count}×</span>}
                      </div>
                      <div className="act-time">{relTime(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      }
      case "list-progress":
        return (
          <Card title="Progresso por área">
            <div className="progress-list">
              {progress.map((p, i) => (
                <div className="prog-item" key={i}>
                  <div className="prog-top">
                    <span className="nm">{p.nm}</span>
                    <span className="vl">{p.v}%</span>
                  </div>
                  <div className="prog-bar"><i style={{ width: p.v + "%" }} /></div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--dim)" }}>
                  {days >= 0 ? "Dias para o evento" : "Evento realizado"}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {days >= 0 ? `${days} dia${days === 1 ? "" : "s"}` : `há ${Math.abs(days)} dias`}
                </div>
              </div>
              {!editing && (
                <button className="btn btn-dark btn-sm" onClick={() => go("checklist")}>Ver checklist</button>
              )}
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="view">
      <PageHead
        eyebrow={ev.name}
        title="Visão geral"
        sub={editing ? "Arraste para reordenar · use os controles em cada card" : syncSub}
        actions={
          editing ? (
            <>
              <button className="btn btn-dark" onClick={() => setAdding(true)}>
                <Icon name="plus" size={15} />Adicionar widget
              </button>
              <button
                className="btn"
                onClick={() => { resetDashboard(); toast("Dashboard restaurado ao padrão"); }}
              >
                Restaurar padrão
              </button>
              <button className="btn btn-primary" onClick={() => setEditing(false)}>
                <Icon name="check" size={15} />Concluir
              </button>
            </>
          ) : (
            <>
              {symplaSync.link && (
                <button
                  className="btn"
                  onClick={async () => {
                    const result = await symplaSync.syncNow();
                    if (result) {
                      toast(`${result.added} novo${result.added === 1 ? "" : "s"} · ${result.updated} atualizado${result.updated === 1 ? "" : "s"} do Sympla`);
                    }
                  }}
                  disabled={symplaSync.busy}
                >
                  <Icon name="refresh" size={15} />{symplaSync.busy ? "Sincronizando" : "Sync Sympla"}
                </button>
              )}
              <button className="btn" onClick={() => setImporting(true)}>
                <Icon name="upload" size={15} />Importar lista
              </button>
              <button
                className="btn"
                disabled
                title="Em breve — estamos ajustando a personalização do dashboard"
              >
                <Icon name="grid" size={15} />Personalizar
              </button>
              <button className="btn btn-primary" onClick={openNewEvent}>
                <Icon name="plus" size={15} />Novo evento
              </button>
            </>
          )
        }
      />

      {highlights.length > 0 && (
        <div className="dash-highlights">
          {highlights.map((h) => (
            <Kpi
              key={h.key}
              icon={h.icon}
              iconTone={h.tone}
              value={h.value}
              label={h.label}
              foot={h.foot ? { text: h.foot.text, tone: h.foot.tone } : undefined}
            />
          ))}
        </div>
      )}

      {cfg.widgets.length === 0 ? (
        <Empty
          icon="grid"
          title="Dashboard vazio"
          sub="Adicione KPIs, gráficos e métricas personalizadas do seu jeito."
          action={
            <button className="btn btn-primary" onClick={() => { setEditing(true); setAdding(true); }}>
              <Icon name="plus" size={15} />Adicionar widget
            </button>
          }
        />
      ) : (
        <div
          ref={dashboardRef}
          className={"dash-grid" + (editing ? " editing" : "")}
          style={{ "--dash-cols": cols } as CSSProperties}
        >
          {responsiveWidgets.map(({ widget: w, span }) => (
            <div
              key={w.id}
              className={
                "dash-widget" +
                ` dash-type-${w.type} dash-span-${span}` +
                (editing ? " editing" : "") +
                (dragId === w.id ? " dragging" : "") +
                (overId === w.id && dragId && dragId !== w.id ? " drag-over" : "")
              }
              style={{ gridColumn: `span ${span}` }}
              draggable={editing}
              onDragStart={editing ? () => setDragId(w.id) : undefined}
              onDragOver={editing ? (e) => { e.preventDefault(); setOverId(w.id); } : undefined}
              onDrop={editing ? () => onDrop(w.id) : undefined}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
            >
              {editing && (
                <div className="dash-tools">
                  <span className="dash-grip" title="Arraste para reordenar"><Icon name="grip" size={15} /></span>
                  {w.type === "kpi" && (
                    <button
                      className="dash-tool"
                      title="Estatísticas laterais"
                      onClick={() => setSideEditId(w.id)}
                    >
                      <Icon name="panelLeft" size={15} />
                    </button>
                  )}
                  <button
                    className="dash-tool"
                    title="Alternar largura"
                    onClick={() => updateDashboardWidget(w.id, { span: nextWidgetSpan(w) })}
                  >
                    {SPAN_LABEL[w.span ?? defaultWidgetSpan(w.type)] ?? "½"}
                  </button>
                  <button
                    className="dash-tool danger"
                    title="Remover widget"
                    onClick={() => { removeDashboardWidget(w.id); toast("Widget removido"); }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              )}
              <div className="dash-body">{renderWidget(w)}</div>
            </div>
          ))}
        </div>
      )}

      {leadOptions.length > 0 && (
        <div className="leadseg">
          <div className="integ-section" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Segmentação de leads
            <span style={{ fontWeight: 500, color: "var(--dim)", fontSize: 12.5 }}>
              · clique para escolher os atributos
            </span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {leadOptions.map((o) => (
              <button
                key={o.key}
                className={"chip" + (selectedBreakdowns.includes(o.key) ? " active" : "")}
                onClick={() => toggleBreakdown(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {selectedBreakdowns.length === 0 ? (
            <Empty
              icon="users"
              title="Nenhum atributo selecionado"
              sub="Clique nos atributos acima para ver a distribuição dos leads."
            />
          ) : (
            <div className="leadseg-grid">
              {selectedBreakdowns.map((key) => {
                const opt = leadOptions.find((o) => o.key === key);
                const rows = leadBreakdown(db, ev.id, key);
                if (!opt || rows.length === 0) return null;
                const top = rows[0].count;
                return (
                  <Card key={key} title={opt.label}>
                    <div className="cat-list">
                      {rows.map((r) => (
                        <div className="cat-row" key={r.value}>
                          <span className="cat-nm" title={r.value}>{r.value}</span>
                          <span className="cat-bar">
                            <i style={{ width: (top ? Math.round((r.count / top) * 100) : 0) + "%" }} />
                          </span>
                          <span className="cat-vl">{r.count} · {r.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {adding && (
        <AddWidgetModal eventId={ev.id} cfg={cfg} k={k} onClose={() => setAdding(false)} />
      )}

      {importing && <ImportAttendeesModal eventId={ev.id} onClose={() => setImporting(false)} />}

      {sideEditId && (() => {
        const widget = cfg.widgets.find((w) => w.id === sideEditId);
        if (!widget) return null;
        return (
          <SideMetricsModal eventId={ev.id} cfg={cfg} k={k} widget={widget} onClose={() => setSideEditId(null)} />
        );
      })()}
    </div>
  );
}
