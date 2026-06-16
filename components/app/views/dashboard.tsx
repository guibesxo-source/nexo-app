"use client";

/* Dashboard do evento — agora customizável (FR pós-MVP): grade de widgets que
   o usuário adiciona/remove/reordena/redimensiona; KPIs do catálogo + métricas
   personalizadas + blocos (gráficos e listas). O layout vive em
   settings.dashboard (cai no DEFAULT_DASHBOARD quando vazio). */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BarChart, Card, Donut, Empty, Field, Icon, Kpi, Modal, PageHead, useToast,
} from "@/components/app/kit";
import { useGo, useUi } from "@/components/app/shell";
import { useSymplaAutoSync } from "@/components/app/sympla-sync";
import {
  addCustomMetric,
  addDashboardWidget,
  catalogMetric,
  categoryTotals,
  customMetricValue,
  dashboardConfig,
  eventById,
  eventKpis,
  formatMetricValue,
  METRIC_CATALOG,
  removeCustomMetric,
  removeDashboardWidget,
  reorderDashboard,
  resetDashboard,
  selectedEvent,
  signupsByDate,
  updateDashboardWidget,
  useDb,
  type EventKpis,
} from "@/lib/db";
import { downloadCsv, toCsv } from "@/lib/csv";
import { daysUntil, fmtMoney, relTime } from "@/lib/format";
import type {
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

const dateOnly = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

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

function baseWidgetSpan(w: DashboardWidget, cols: number, editing: boolean): number {
  const configured = Math.min(cols, Math.max(1, w.span ?? defaultWidgetSpan(w.type)));
  if (editing) return configured;
  if (cols >= 4 && w.type === "chart-confirm" && configured <= 2) return 1;
  if (cols >= 4 && w.type === "chart-signups" && configured <= 2) return 2;
  return configured;
}

function canGrowWidget(w: DashboardWidget): boolean {
  return w.type !== "kpi" && w.type !== "chart-confirm";
}

function layoutWidgets(widgets: DashboardWidget[], cols: number, editing: boolean) {
  const out: { widget: DashboardWidget; span: number }[] = [];
  let row: { widget: DashboardWidget; span: number }[] = [];
  let used = 0;

  const flush = () => {
    if (!row.length) return;
    let remaining = cols - row.reduce((sum, item) => sum + item.span, 0);
    while (!editing && remaining > 0) {
      let changed = false;
      for (const item of row) {
        const growable = canGrowWidget(item.widget) || row.length === 1;
        if (!growable || item.span >= cols || remaining <= 0) continue;
        item.span += 1;
        remaining -= 1;
        changed = true;
      }
      if (!changed) break;
    }
    out.push(...row);
    row = [];
    used = 0;
  };

  for (const widget of widgets) {
    const span = baseWidgetSpan(widget, cols, editing);
    if (row.length && used + span > cols) flush();
    row.push({ widget, span });
    used += span;
    if (used >= cols) flush();
  }
  flush();
  return out;
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

/* ---------- view ---------- */

export function Dashboard({ eventId }: { eventId?: string }) {
  const db = useDb();
  const go = useGo();
  const toast = useToast();
  const { openNewEvent } = useUi();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [signupFrom, setSignupFrom] = useState("");
  const [signupTo, setSignupTo] = useState("");
  const [signupPickerOpen, setSignupPickerOpen] = useState(false);
  const [cols, setCols] = useState(4);

  const ev = eventId ? eventById(db, eventId) : selectedEvent(db);
  const symplaSync = useSymplaAutoSync(ev?.id ?? null);
  const cfg = dashboardConfig(db);
  const responsiveWidgets = useMemo(
    () => layoutWidgets(cfg.widgets, cols, editing),
    [cfg.widgets, cols, editing]
  );

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
  const signups = signupsByDate(db, ev.id, {
    from: signupFrom || undefined,
    to: signupTo || undefined,
    days: 14,
  });
  const today = dateOnly(new Date());
  const signupToday = signupsByDate(db, ev.id, { from: today, to: today }).reduce((sum, item) => sum + item.v, 0);
  const signupTotal = signups.reduce((sum, item) => sum + item.v, 0);
  const hasSignupFilter = !!signupFrom || !!signupTo;
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

  const exportSummary = () => {
    const csv = toCsv(
      ["Indicador", "Valor"],
      [
        ["Evento", ev.name],
        ["Inscritos", k.total],
        ["Confirmados", k.confirmed],
        ["Check-ins", k.checkin],
        ["Taxa de confirmação (%)", k.confirmRate],
        ["Orçamento previsto", ev.budget_planned],
        ["Gasto", k.spent],
        ["Receitas", k.income],
        ["Saldo disponível", k.available],
        ["Tarefas concluídas", `${k.tasksDone}/${k.tasksTotal}`],
        ["Tarefas atrasadas", k.tasksLate],
        ["Custo por inscrito", k.costPerAttendee],
      ]
    );
    downloadCsv(`nexo-resumo-${ev.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Resumo exportado (CSV)");
  };

  const ids = cfg.widgets.map((w) => w.id);
  const onDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) reorderDashboard(reorderIds(ids, dragId, targetId));
    setDragId(null);
    setOverId(null);
  };

  const resolveKpi = (w: DashboardWidget) => {
    const key = w.metric ?? "";
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
    return { icon: "sparkle", tone: undefined as string | undefined, label: "Métrica removida", value: "—" };
  };

  const renderWidget = (w: DashboardWidget) => {
    switch (w.type) {
      case "kpi": {
        const r = resolveKpi(w);
        return <Kpi icon={r.icon} iconTone={r.tone} value={r.value} label={r.label} />;
      }
      case "chart-signups":
        return (
          <Card
            title="Inscritos por data"
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
            <div className="dash-chart-total">
              <b>{signupToday}</b> hoje · <b>{signupTotal}</b> no periodo
            </div>
            <BarChart data={signups} />
          </Card>
        );
      case "chart-confirm":
        return (
          <Card title="Confirmação">
            <Donut
              pct={k.confirmRate}
              label="conf."
              legend={[
                { color: "var(--green)", label: "Confirmados", value: String(k.confirmed) },
                { color: "#E8E8E5", label: "Pendentes", value: String(k.pending) },
              ]}
            />
          </Card>
        );
      case "chart-category":
        return (
          <Card title="Gastos por categoria">
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
      case "list-activity":
        return (
          <Card title="Atividade recente">
            {db.activity.length === 0 ? (
              <Empty icon="bolt" title="Sem atividade ainda" sub="As ações da equipe aparecem aqui." />
            ) : (
              <div className="activity">
                {db.activity.slice(0, 5).map((a) => (
                  <div className="act-row" key={a.id}>
                    <span className="act-ic">{a.icon}</span>
                    <div className="act-body">
                      <div className="act-txt">{a.text.map((s, j) => (j % 2 ? <b key={j}>{s}</b> : s))}</div>
                      <div className="act-time">{relTime(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
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
              <button className="btn" onClick={exportSummary}>
                <Icon name="download" size={15} />Exportar
              </button>
              <button className="btn" onClick={() => setEditing(true)}>
                <Icon name="grid" size={15} />Personalizar
              </button>
              <button className="btn btn-primary" onClick={openNewEvent}>
                <Icon name="plus" size={15} />Novo evento
              </button>
            </>
          )
        }
      />

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
                  <button
                    className="dash-tool"
                    title="Alternar largura"
                    onClick={() =>
                      updateDashboardWidget(
                        w.id,
                        w.type === "kpi"
                          ? { span: (w.span ?? 1) >= 2 ? 1 : 2 }
                          : { span: (w.span ?? 2) >= 4 ? 2 : 4 }
                      )
                    }
                  >
                    {(w.span ?? (w.type === "kpi" ? 1 : 2)) >= 4 ? "▭" : (w.span ?? 1) >= 2 ? "½" : "¼"}
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

      {adding && (
        <AddWidgetModal eventId={ev.id} cfg={cfg} k={k} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
