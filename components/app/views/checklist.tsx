"use client";

/* Checklist — FR-D1..D3: tarefas por evento com responsável, prazo,
   progresso e destaque de atrasadas. */
import { useCallback, useEffect, useState } from "react";
import {
  Avatar, Badge, Card, Empty, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import { ClickupImportModal } from "@/components/app/clickup-import";
import {
  addTask,
  allTemplates,
  applyTemplate,
  categorizeChecklistTask,
  isTaskLate,
  memberById,
  PHASE_META,
  phaseOf,
  removeTask,
  removeTemplate,
  saveChecklistAsTemplate,
  selectedEvent,
  tasksOf,
  toggleTask,
  useDb,
} from "@/lib/db";
import { TaskDetail } from "@/components/app/task-detail";
import { taskSchema } from "@/lib/validations/task";
import { templateNameSchema } from "@/lib/validations/template";
import { daysUntil, fmtDateShort, fmtMoney } from "@/lib/format";
import type { ChecklistTemplate, Event, Task, TaskPhase } from "@/types";

const FORMAT_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  hibrido: "Híbrido",
};

const DEFAULT_GROUPS = [
  "Conteúdo & Criativos",
  "Inscrições & Público",
  "Comunicação",
  "Comercial & Patrocínios",
  "Operação & Logística",
  "Programação & Palco",
  "Técnico & Audiovisual",
  "Financeiro & Jurídico",
  "Pós-evento",
  "Geral",
];

const CATEGORY_ICONS: { match: string[]; icon: string }[] = [
  { match: ["conteúdo", "criativo", "branding"], icon: "image" },
  { match: ["inscrição", "público", "credencial"], icon: "ticket" },
  { match: ["comunicação", "email", "whatsapp"], icon: "mail" },
  { match: ["comercial", "patroc"], icon: "wallet" },
  { match: ["operação", "logística", "produção"], icon: "grid" },
  { match: ["programação", "palco"], icon: "calendarDays" },
  { match: ["técnico", "audiovisual"], icon: "bolt" },
  { match: ["financeiro", "jurídico"], icon: "wallet" },
  { match: ["pós"], icon: "checkSquare" },
];

function categoryIcon(name: string): string {
  const n = name.toLowerCase();
  return CATEGORY_ICONS.find((x) => x.match.some((m) => n.includes(m)))?.icon ?? "checkSquare";
}

function phaseMeta(id: TaskPhase) {
  return PHASE_META.find((p) => p.id === id) ?? PHASE_META[0];
}

function dueText(t: Task): string {
  if (!t.due_date) return "sem prazo";
  return fmtDateShort(t.due_date);
}

type PriorityId = "late" | "today" | "next" | "scheduled" | "no_due" | "done";

const PRIORITY_META: {
  id: PriorityId;
  label: string;
  sub: string;
  icon: string;
  tone: "danger" | "hot" | "next" | "muted" | "done";
}[] = [
  { id: "late", label: "Atrasadas", sub: "resolver primeiro", icon: "bolt", tone: "danger" },
  { id: "today", label: "Hoje", sub: "prazo no dia", icon: "clock", tone: "hot" },
  { id: "next", label: "Próximos 7 dias", sub: "preparar agora", icon: "calendarDays", tone: "next" },
  { id: "scheduled", label: "Programadas", sub: "depois desta semana", icon: "calendar", tone: "muted" },
  { id: "no_due", label: "Sem prazo", sub: "definir data", icon: "note", tone: "muted" },
  { id: "done", label: "Concluídas", sub: "histórico", icon: "checkSquare", tone: "done" },
];

function taskPriority(t: Task): PriorityId {
  if (t.status === "concluida") return "done";
  if (isTaskLate(t)) return "late";
  if (!t.due_date) return "no_due";
  const d = daysUntil(t.due_date);
  if (d <= 0) return "today";
  if (d <= 7) return "next";
  return "scheduled";
}

function taskSegment(t: Task): string {
  return categorizeChecklistTask(t.title, t.group);
}

function TaskFormModal({ eventId, groups, defaultPhase = "pre", onClose }: {
  eventId: string; groups: string[]; defaultPhase?: TaskPhase; onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    group: groups[0] ?? DEFAULT_GROUPS[0],
    phase: defaultPhase,
    assignee_id: "",
    due_date: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // campos de texto; a fase tem onChange próprio (valor tipado TaskPhase)
  const set = (key: Exclude<keyof typeof form, "phase">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const parsed = taskSchema.safeParse({
      ...form,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    addTask(eventId, parsed.data);
    toast("Tarefa criada");
    onClose();
  };

  const groupOptions = [...new Set([...groups, ...DEFAULT_GROUPS])];

  return (
    <Modal
      title="Nova tarefa"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Criar tarefa</button>
        </>
      }
    >
      <Field label="Título" error={errors.title}>
        <input
          className="input"
          placeholder="Ex.: Contratar fornecedor de catering"
          value={form.title}
          onChange={set("title")}
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Fase" error={errors.phase}>
          <select
            className="input"
            value={form.phase}
            onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value as TaskPhase }))}
          >
            {PHASE_META.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Grupo" error={errors.group}>
          <input className="input" list="task-groups" value={form.group} onChange={set("group")} />
          <datalist id="task-groups">
            {groupOptions.map((g) => <option key={g} value={g} />)}
          </datalist>
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Responsável" error={errors.assignee_id}>
          <select className="input" value={form.assignee_id} onChange={set("assignee_id")}>
            <option value="">Sem responsável</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Prazo" error={errors.due_date}>
          <input className="input" type="date" value={form.due_date} onChange={set("due_date")} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------- Templates ---------- */

const groupsOf = (tpl: ChecklistTemplate) => [...new Set(tpl.items.map((i) => i.group))];

function TemplateRow({ tpl, onApply, onDelete }: {
  tpl: ChecklistTemplate; onApply: () => void; onDelete?: () => void;
}) {
  const groups = groupsOf(tpl);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
        border: "1px solid var(--line)", borderRadius: 12, marginBottom: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{tpl.name}</span>
          {tpl.format && <Badge tone="gray">{FORMAT_LABEL[tpl.format] ?? tpl.format}</Badge>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 3 }}>
          {tpl.items.length} tarefas · {groups.slice(0, 4).join(" · ")}
          {groups.length > 4 ? " · …" : ""}
        </div>
      </div>
      {onDelete && (
        <button className="row-action" title="Excluir template" onClick={onDelete}>
          <Icon name="trash" size={15} />
        </button>
      )}
      <button className="btn btn-primary" onClick={onApply}>Aplicar</button>
    </div>
  );
}

function TemplatePickerModal({ event, onClose, onClickupImport }: {
  event: Event;
  onClose: () => void;
  onClickupImport?: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const templates = allTemplates(db);
  const builtins = templates.filter((t) => t.builtin);
  const custom = templates.filter((t) => !t.builtin);
  const clickupConnected = !!db.settings.clickup_token;

  const apply = (tpl: ChecklistTemplate) => {
    const n = applyTemplate(event.id, tpl);
    toast(`${n} ${n === 1 ? "tarefa adicionada" : "tarefas adicionadas"}`);
    onClose();
  };

  return (
    <Modal
      title="Aplicar template"
      onClose={onClose}
      width={560}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p className="cover-hint" style={{ marginTop: 0 }}>
        As tarefas são adicionadas ao checklist deste evento (sem apagar as existentes).
        Os prazos são calculados a partir da data do evento.
      </p>
      {clickupConnected && onClickupImport && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            border: "1px solid var(--line)", borderRadius: 12, marginBottom: 12,
            background: "var(--panel)",
          }}
        >
          <span className="empty-ic" style={{ width: 36, height: 36, borderRadius: 10, margin: 0 }}>
            <Icon name="bolt" size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>Importar do ClickUp</div>
            <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 2 }}>
              Escolha uma pasta e depois o projeto/lista para usar como template.
            </div>
          </div>
          <button className="btn btn-primary" onClick={onClickupImport}>Escolher</button>
        </div>
      )}
      <div>
        {builtins.map((tpl) => (
          <TemplateRow key={tpl.id} tpl={tpl} onApply={() => apply(tpl)} />
        ))}
      </div>
      {custom.length > 0 && (
        <>
          <div className="task-group-head" style={{ marginTop: 18 }}>
            <span className="tg-title">Seus templates</span>
            <span className="tg-line" />
          </div>
          <div>
            {custom.map((tpl) => (
              <TemplateRow
                key={tpl.id}
                tpl={tpl}
                onApply={() => apply(tpl)}
                onDelete={() => {
                  removeTemplate(tpl.id);
                  toast("Template excluído");
                }}
              />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function SaveTemplateModal({ event, taskCount, onClose }: {
  event: Event; taskCount: number; onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const submit = () => {
    const parsed = templateNameSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    saveChecklistAsTemplate(event.id, parsed.data.name);
    toast("Template salvo");
    onClose();
  };

  return (
    <Modal
      title="Salvar como template"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Salvar template</button>
        </>
      }
    >
      <p className="cover-hint" style={{ marginTop: 0 }}>
        Salva as {taskCount} {taskCount === 1 ? "tarefa" : "tarefas"} deste checklist
        (grupos e prazos relativos à data do evento) como um template reutilizável.
      </p>
      <Field label="Nome do template" error={error}>
        <input
          className="input"
          autoFocus
          placeholder="Ex.: Meu checklist padrão"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
        />
      </Field>
    </Modal>
  );
}

const SEGMENTS: [string, string][] = [
  ["todas", "Todas"],
  ["abertas", "Abertas"],
  ["atrasadas", "Atrasadas"],
  ["concluidas", "Concluídas"],
];
const SEGMENT_IDS = new Set(SEGMENTS.map(([id]) => id));

function initialChecklistTab(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("tab");
}

export function Checklist() {
  const db = useDb();
  const toast = useToast();
  const [seg, setSeg] = useState(() => {
    const tab = initialChecklistTab();
    return tab && SEGMENT_IDS.has(tab) ? tab : "todas";
  });
  const [adding, setAdding] = useState(() => initialChecklistTab() === "nova");
  const [picking, setPicking] = useState(() => initialChecklistTab() === "templates");
  const [saving, setSaving] = useState(false);
  const [clickupImport, setClickupImport] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);

  const applyShortcut = useCallback((shortcut: string | null | undefined) => {
    if (!shortcut) return;
    if (SEGMENT_IDS.has(shortcut)) {
      setSeg(shortcut);
      setAdding(false);
      setPicking(false);
      setClickupImport(false);
      return;
    }
    if (shortcut === "templates") {
      setAdding(false);
      setClickupImport(false);
      setPicking(true);
      return;
    }
    if (shortcut === "nova") {
      setPicking(false);
      setClickupImport(false);
      setAdding(true);
    }
  }, []);

  useEffect(() => {
    const onShortcut: EventListener = (event) => {
      applyShortcut((event as unknown as CustomEvent<string>).detail);
    };
    window.addEventListener("nexo:checklist", onShortcut);
    return () => window.removeEventListener("nexo:checklist", onShortcut);
  }, [applyShortcut]);

  const ev = selectedEvent(db);
  const all = ev ? tasksOf(db, ev.id) : [];
  const completed = all.filter((t) => t.status === "concluida").length;
  const late = all.filter(isTaskLate).length;
  const pct = all.length ? Math.round((completed / all.length) * 100) : 0;

  const matches = (t: Task) =>
    seg === "todas" ||
    (seg === "abertas" && t.status === "aberta") ||
    (seg === "atrasadas" && isTaskLate(t)) ||
    (seg === "concluidas" && t.status === "concluida");

  const groupNames = [
    ...new Set([
      ...DEFAULT_GROUPS,
      ...all.map((t) => t.group),
      ...all.map(taskSegment),
    ]),
  ];
  const categoryOrder = new Map(DEFAULT_GROUPS.map((g, i) => [g, i]));

  const sortTasks = (tasks: Task[]) =>
    tasks.slice().sort((a, b) => {
      const ad = a.due_date ?? "9999-12-31";
      const bd = b.due_date ?? "9999-12-31";
      return ad.localeCompare(bd) || a.title.localeCompare(b.title);
    });

  const sortSegments = (a: { name: string }, b: { name: string }) => {
    const ao = categoryOrder.get(a.name) ?? 999;
    const bo = categoryOrder.get(b.name) ?? 999;
    return ao - bo || a.name.localeCompare(b.name);
  };

  const prioritySections = PRIORITY_META.map((priority) => {
    const tasks = sortTasks(all.filter(matches).filter((t) => taskPriority(t) === priority.id));
    const bySegment = new Map<string, Task[]>();
    for (const t of tasks) {
      const name = taskSegment(t);
      bySegment.set(name, [...(bySegment.get(name) ?? []), t]);
    }
    const segments = [...bySegment.entries()]
      .map(([name, segmentTasks]) => ({ name, tasks: sortTasks(segmentTasks) }))
      .sort(sortSegments);
    return { ...priority, tasks, segments };
  }).filter((section) => section.tasks.length > 0);

  const open = all.length - completed;
  const priorityCounts = PRIORITY_META.map((priority) => ({
    ...priority,
    total: all.filter((t) => taskPriority(t) === priority.id).length,
  }));

  const toggle = (t: Task) => {
    toggleTask(t.id);
    toast(t.status === "aberta" ? `Tarefa concluída · ${t.title}` : "Tarefa reaberta");
  };

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Checklist" sub="Nenhum evento criado ainda" />
        <Empty icon="checkSquare" title="Crie um evento primeiro" sub="O checklist pertence a um evento." />
      </div>
    );
  }

  return (
    <div className="view">
      <PageHead
        title="Checklist de produção"
        sub={`${ev.name} · ${completed} de ${all.length} tarefas concluídas${late > 0 ? ` · ${late} atrasadas` : ""}`}
        actions={
          <>
            <div className="seg">
              {SEGMENTS.map(([id, label]) => (
                <button
                  key={id}
                  className={seg === id ? "active" : ""}
                  onClick={() => setSeg(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => setPicking(true)}>
              <Icon name="sparkle" size={15} />Template
            </button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} />Nova tarefa
            </button>
            {all.length > 0 && (
              <Menu
                items={[{ label: "Salvar como template", onClick: () => setSaving(true) }]}
              />
            )}
          </>
        }
      />

      {all.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div className="check-overview">
            <div className="check-overview-main">
              <div>
                <div className="check-overline">Progresso do checklist</div>
                <div className="check-over-title">{pct}% concluído</div>
              </div>
              <div className="check-over-stats">
                {([["Abertas", open, "var(--text)"], ["Concluídas", completed, "var(--green-deep)"], ["Atrasadas", late, "var(--red)"]] as [string, number, string][]).map(([label, value, color]) => (
                  <div className="check-over-stat" key={label}>
                    <span className="v" style={{ color }}>{value}</span>
                    <span className="k">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="prog-bar" style={{ height: 9 }}><i style={{ width: pct + "%" }} /></div>
            <div className="check-phase-strip">
              {priorityCounts.map((priority) => (
                <span className={"check-priority-chip " + priority.tone} key={priority.id}>
                  {priority.label} <b>{priority.total}</b>
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {all.length === 0 ? (
        <Empty
          icon="checkSquare"
          title="Checklist vazio"
          sub="Crie tarefas do zero ou comece a partir de um template por tipo de evento."
          action={
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-primary" onClick={() => setAdding(true)}>
                <Icon name="plus" size={15} />Criar primeira tarefa
              </button>
              <button className="btn" onClick={() => setPicking(true)}>
                <Icon name="sparkle" size={15} />Usar um template
              </button>
            </div>
          }
        />
      ) : (
        prioritySections.length === 0 ? (
          <Empty
            icon="filter"
            title="Nada nesse filtro"
            sub="Troque o filtro no topo ou crie uma nova tarefa para este evento."
          />
        ) : (
          <div className="check-board">
            {prioritySections.map((section) => (
              <section key={section.id} className={"priority-block " + section.tone}>
                <div className="priority-head">
                  <span className="priority-ic"><Icon name={section.icon} size={17} /></span>
                  <div className="priority-meta">
                    <div className="priority-title">{section.label}</div>
                    <div className="priority-sub">{section.sub}</div>
                  </div>
                  <span className="priority-count">{section.tasks.length}</span>
                </div>

                <div className="priority-segments">
                  {section.segments.map((grp) => {
                    const done = grp.tasks.filter((t) => t.status === "concluida").length;
                    const catPct = grp.tasks.length ? Math.round((done / grp.tasks.length) * 100) : 0;
                    return (
                      <section key={grp.name} className="check-cat">
                        <div className="check-cat-head">
                          <span className="check-cat-ic"><Icon name={categoryIcon(grp.name)} size={17} /></span>
                          <div className="check-cat-meta">
                            <div className="check-cat-title">{grp.name}</div>
                            <div className="check-cat-sub">{done}/{grp.tasks.length} concluídas</div>
                          </div>
                          <div className="check-cat-progress">
                            <span>{catPct}%</span>
                            <div className="mini-bar"><i style={{ width: `${catPct}%` }} /></div>
                          </div>
                        </div>

                        <div className="check-task-list">
                          {grp.tasks.map((t) => {
                            const isDone = t.status === "concluida";
                            const assignee = memberById(db, t.assignee_id);
                            const ph = phaseMeta(phaseOf(t, ev));
                            const hasCost = Boolean(t.finance_tx_id || t.cost_estimate);
                            return (
                              <div className={"task task-rich" + (isDone ? " done" : "")} key={t.id}>
                                <button className="checkbox" onClick={() => toggle(t)} title={isDone ? "Reabrir" : "Concluir"}>
                                  <Icon name="check" size={14} />
                                </button>
                                <div
                                  className="task-main"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setOpenTask(t.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setOpenTask(t.id);
                                    }
                                  }}
                                >
                                  <div className="task-topline">
                                    <div className="task-name">{t.title}</div>
                                    <span className="task-phase">{ph.short}</span>
                                  </div>
                                  <div className="task-meta">
                                    {isDone ? (
                                      <Badge tone="green" dot>Concluída</Badge>
                                    ) : isTaskLate(t) ? (
                                      <Badge tone="red" dot>Atrasada</Badge>
                                    ) : (
                                      <Badge tone="gray" dot>Aberta</Badge>
                                    )}
                                    <span className="task-meta-item">
                                      <Icon name="clock" size={12} />
                                      {dueText(t)}
                                    </span>
                                    {assignee ? (
                                      <span className="task-meta-item">
                                        <Avatar initials={assignee.initials} size="sm" />{assignee.name}
                                      </span>
                                    ) : (
                                      <span className="task-meta-item muted">
                                        <Icon name="users" size={12} />Sem responsável
                                      </span>
                                    )}
                                    {(t.attachments?.length ?? 0) > 0 && (
                                      <span className="task-meta-item">
                                        <Icon name="paperclip" size={12} />{t.attachments!.length}
                                      </span>
                                    )}
                                    {t.description && (
                                      <span className="task-meta-item">
                                        <Icon name="edit" size={12} />nota
                                      </span>
                                    )}
                                    {hasCost && (
                                      <span className={"task-meta-item" + (t.finance_tx_id ? " good" : "")}>
                                        <Icon name="wallet" size={12} />
                                        {t.finance_tx_id ? "lançado" : fmtMoney(t.cost_estimate ?? 0)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="task-actions">
                                  <button
                                    className="task-icon-btn"
                                    title="Abrir tarefa"
                                    onClick={() => setOpenTask(t.id)}
                                  >
                                    <Icon name="chevRight" size={15} />
                                  </button>
                                  <button
                                    className="task-icon-btn danger"
                                    title="Excluir tarefa"
                                    onClick={() => {
                                      removeTask(t.id);
                                      toast("Tarefa excluída");
                                    }}
                                  >
                                    <Icon name="trash" size={15} />
                                  </button>
                                  <Menu
                                    items={[
                                      {
                                        label: isDone ? "Reabrir tarefa" : "Concluir tarefa",
                                        onClick: () => toggle(t),
                                      },
                                    ]}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {adding && (
        <TaskFormModal
          eventId={ev.id}
          groups={groupNames}
          onClose={() => setAdding(false)}
        />
      )}

      {picking && (
        <TemplatePickerModal
          event={ev}
          onClose={() => setPicking(false)}
          onClickupImport={() => {
            setPicking(false);
            setClickupImport(true);
          }}
        />
      )}

      {clickupImport && (
        <ClickupImportModal
          eventId={ev.id}
          eventName={ev.name}
          onClose={() => setClickupImport(false)}
        />
      )}

      {saving && (
        <SaveTemplateModal event={ev} taskCount={all.length} onClose={() => setSaving(false)} />
      )}

      {openTask && (
        <TaskDetail key={openTask} taskId={openTask} onClose={() => setOpenTask(null)} />
      )}
    </div>
  );
}
