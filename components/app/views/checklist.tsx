"use client";

/* Checklist — FR-D1..D3: tarefas por evento com responsável, prazo,
   progresso e destaque de atrasadas. */
import { useState } from "react";
import {
  Avatar, Badge, Card, Empty, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import {
  addTask,
  allTemplates,
  applyTemplate,
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
import { fmtDateShort, fmtMoney } from "@/lib/format";
import type { ChecklistTemplate, Event, Task, TaskPhase } from "@/types";

const FORMAT_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  hibrido: "Híbrido",
};

const DEFAULT_GROUPS = ["Pré-produção", "Marketing & Inscrições", "Produção & Dia do evento"];

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

function TemplatePickerModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const templates = allTemplates(db);
  const builtins = templates.filter((t) => t.builtin);
  const custom = templates.filter((t) => !t.builtin);

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

export function Checklist() {
  const db = useDb();
  const toast = useToast();
  const [seg, setSeg] = useState("todas");
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);

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

  // Agrupa por fase (pré/durante/pós) e, dentro de cada fase, por grupo
  // (preservando a ordem de aparição dos grupos).
  const byPhase = new Map<TaskPhase, { name: string; tasks: Task[] }[]>();
  for (const t of all) {
    const ph = phaseOf(t, ev);
    let groups = byPhase.get(ph);
    if (!groups) {
      groups = [];
      byPhase.set(ph, groups);
    }
    let g = groups.find((x) => x.name === t.group);
    if (!g) {
      g = { name: t.group, tasks: [] };
      groups.push(g);
    }
    g.tasks.push(t);
  }
  const groupNames = [...new Set(all.map((t) => t.group))];

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Progresso geral</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{pct}%</div>
          </div>
          <div className="prog-bar" style={{ height: 9 }}><i style={{ width: pct + "%" }} /></div>
          <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
            {([
              ["Concluídas", completed, "var(--green-deep)"],
              ["Pendentes", all.length - completed, "var(--text)"],
              ["Atrasadas", late, "var(--red)"],
            ] as [string, number, string][]).map(([label, value, color], i) => (
              <div key={i}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 11.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                  {label}
                </div>
              </div>
            ))}
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
        PHASE_META.map((ph) => {
          const phaseGroups = byPhase.get(ph.id) ?? [];
          const phaseTasks = phaseGroups.flatMap((g) => g.tasks);
          if (phaseTasks.filter(matches).length === 0) return null;
          const phaseDone = phaseTasks.filter((t) => t.status === "concluida").length;
          return (
            <div key={ph.id} className="phase-block">
              <div className="phase-head">
                <span className="ph-title">{ph.label}</span>
                <span className="ph-count">{phaseDone}/{phaseTasks.length}</span>
              </div>
              {phaseGroups.map((grp) => {
                const visible = grp.tasks.filter(matches);
                if (visible.length === 0) return null;
                const done = grp.tasks.filter((t) => t.status === "concluida").length;
                return (
                  <div key={grp.name} className="checklist">
                    <div className="task-group-head">
                      <span className="tg-title">{grp.name}</span>
                      <span className="tg-count">{done}/{grp.tasks.length}</span>
                      <span className="tg-line" />
                    </div>
                    {visible.map((t) => {
                      const isDone = t.status === "concluida";
                      const assignee = memberById(db, t.assignee_id);
                      return (
                        <div className={"task" + (isDone ? " done" : "")} key={t.id}>
                          <span className="checkbox" onClick={() => toggle(t)}>
                            <Icon name="check" size={14} />
                          </span>
                          <div
                            className="task-main"
                            role="button"
                            style={{ cursor: "pointer" }}
                            onClick={() => setOpenTask(t.id)}
                          >
                            <div className="task-name">{t.title}</div>
                            <div className="task-meta">
                              {isDone ? (
                                <Badge tone="green" dot>Concluída</Badge>
                              ) : isTaskLate(t) ? (
                                <Badge tone="red" dot>Atrasada</Badge>
                              ) : (
                                <Badge tone="gray" dot>Pendente</Badge>
                              )}
                              <span className="row" style={{ gap: 5 }}>
                                <Icon name="clock" size={12} />
                                {t.due_date ? fmtDateShort(t.due_date) : "sem prazo"}
                              </span>
                              {(t.attachments?.length ?? 0) > 0 && (
                                <span className="row" style={{ gap: 4 }}>
                                  <Icon name="paperclip" size={12} />{t.attachments!.length}
                                </span>
                              )}
                              {t.description && (
                                <span className="row" style={{ gap: 4 }}>
                                  <Icon name="edit" size={12} />nota
                                </span>
                              )}
                              {t.finance_tx_id ? (
                                <span className="row" style={{ gap: 4, color: "var(--green-deep)" }}>
                                  <Icon name="wallet" size={12} />lançado
                                </span>
                              ) : t.cost_estimate ? (
                                <span className="row" style={{ gap: 4 }}>
                                  <Icon name="wallet" size={12} />{fmtMoney(t.cost_estimate)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="task-assignee row" style={{ gap: 6 }}>
                            {assignee && <Avatar initials={assignee.initials} size="sm" />}
                            <Menu
                              items={[
                                {
                                  label: isDone ? "Reabrir tarefa" : "Concluir tarefa",
                                  onClick: () => toggle(t),
                                },
                                {
                                  label: "Excluir",
                                  danger: true,
                                  onClick: () => {
                                    removeTask(t.id);
                                    toast("Tarefa excluída");
                                  },
                                },
                              ]}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {adding && (
        <TaskFormModal
          eventId={ev.id}
          groups={groupNames}
          onClose={() => setAdding(false)}
        />
      )}

      {picking && <TemplatePickerModal event={ev} onClose={() => setPicking(false)} />}

      {saving && (
        <SaveTemplateModal event={ev} taskCount={all.length} onClose={() => setSaving(false)} />
      )}

      {openTask && (
        <TaskDetail key={openTask} taskId={openTask} onClose={() => setOpenTask(null)} />
      )}
    </div>
  );
}
