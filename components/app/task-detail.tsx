"use client";

/* Detalhe da tarefa — abre como a busca (overlay com fundo desfocado).
   Edita título/descrição/responsável/grupo/prazo, anexa imagens e arquivos,
   e traz o "Contexto Nexo": prazo em tempo de evento (D-X) + custo que é
   lançado direto no Financeiro (o checklist conversa com o orçamento). */
import { useEffect, useRef, useState } from "react";
import { Badge, Icon, MoneyInput, useToast } from "@/components/app/kit";
import { useGo } from "@/components/app/shell";
import {
  addTaskAttachment,
  eventById,
  isTaskLate,
  logTaskToFinance,
  memberById,
  PAYMENT_META,
  PHASE_META,
  phaseOf,
  removeTask,
  removeTaskAttachment,
  selectEvent,
  taskById,
  toggleTask,
  txById,
  unlinkTaskFinance,
  updateTask,
  useDb,
} from "@/lib/db";
import { compressImage, downloadDataUrl, fileToDataUrl } from "@/lib/files";
import { daysUntil, fmtMoney } from "@/lib/format";
import type { TaskPhase } from "@/types";

/** Posição do prazo na linha do tempo do evento (D-14, Dia D, D+2…). */
function eventDelta(eventStart?: string, due?: string | null): { dx: string; sub: string } | null {
  if (!eventStart || !due) return null;
  const ev = new Date(eventStart);
  const d = new Date(due + "T00:00:00");
  if (Number.isNaN(ev.getTime()) || Number.isNaN(d.getTime())) return null;
  const evDay = new Date(ev.getFullYear(), ev.getMonth(), ev.getDate());
  const delta = Math.round((d.getTime() - evDay.getTime()) / 86400000);
  if (delta === 0) return { dx: "Dia D", sub: "no dia do evento" };
  if (delta < 0) return { dx: `D-${-delta}`, sub: `${-delta} ${-delta === 1 ? "dia" : "dias"} antes do evento` };
  return { dx: `D+${delta}`, sub: `${delta} ${delta === 1 ? "dia" : "dias"} após o evento` };
}

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const go = useGo();
  const fileRef = useRef<HTMLInputElement>(null);
  const task = taskById(db, taskId);

  // edição de texto vive em estado local e persiste no blur
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [costCents, setCostCents] = useState(
    task?.cost_estimate ? Math.round(task.cost_estimate * 100) : 0
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!task) return null; // a tarefa foi removida enquanto o painel estava aberto

  const ev = eventById(db, task.event_id);
  const assignee = memberById(db, task.assignee_id);
  const isDone = task.status === "concluida";
  const late = isTaskLate(task);
  const attachments = task.attachments ?? [];
  const linkedTx = txById(db, task.finance_tx_id ?? null);
  const groups = [
    ...new Set(db.tasks.filter((t) => t.event_id === task.event_id).map((t) => t.group)),
  ];
  const delta = eventDelta(ev?.starts_at, task.due_date);
  const dueLeft = task.due_date ? daysUntil(task.due_date) : null;

  const saveTitle = () => {
    const v = title.trim();
    if (v && v !== task.title) updateTask(task.id, { title: v });
    else setTitle(task.title);
  };
  const saveDesc = () => {
    if (desc !== (task.description ?? "")) updateTask(task.id, { description: desc });
  };
  const saveCost = () => {
    const v = costCents / 100;
    if (v !== (task.cost_estimate ?? 0)) updateTask(task.id, { cost_estimate: v || undefined });
  };

  const onFiles = async (files: FileList) => {
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        if (f.type.startsWith("image/")) {
          addTaskAttachment(task.id, { name: f.name, kind: "image", data: await compressImage(f, 1600, 0.82) });
          ok++;
        } else {
          if (f.size > 1.5 * 1024 * 1024) {
            throw new Error(`"${f.name}" é grande demais — máximo ~1,5 MB nesta fase local`);
          }
          addTaskAttachment(task.id, { name: f.name, kind: "file", data: await fileToDataUrl(f) });
          ok++;
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não consegui ler esse arquivo");
      }
    }
    if (ok > 0) toast(ok === 1 ? "Anexo adicionado" : `${ok} anexos adicionados`);
  };

  const lancar = () => {
    saveCost();
    const id = logTaskToFinance(task.id);
    toast(id ? "Lançado no financeiro" : "Defina um custo previsto primeiro");
  };

  const openFinance = () => {
    selectEvent(task.event_id);
    go("financeiro");
    onClose();
  };

  return (
    <div className="task-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="task-sheet" role="dialog" aria-modal>
        <div className="ts-head">
          <button
            className={"ts-check" + (isDone ? " done" : "")}
            onClick={() => toggleTask(task.id)}
            title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
          >
            <Icon name="check" size={15} />
          </button>
          <div className="ts-head-meta">
            <span className="ts-eyebrow">{ev?.name ?? "Tarefa"} · {task.group}</span>
            {isDone ? (
              <Badge tone="green" dot>Concluída</Badge>
            ) : late ? (
              <Badge tone="red" dot>Atrasada</Badge>
            ) : (
              <Badge tone="gray" dot>Aberta</Badge>
            )}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <input
          className="ts-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Título da tarefa"
        />

        <div className="ts-body">
          <div className="ts-main">
            <label className="ts-label">Descrição</label>
            <textarea
              className="ts-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={saveDesc}
              placeholder="Adicione contexto, links, instruções e decisões da tarefa…"
              rows={5}
            />

            <div className="ts-att-head">
              <label className="ts-label" style={{ margin: 0 }}>
                Anexos {attachments.length > 0 && <span className="ts-count">{attachments.length}</span>}
              </label>
              <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} />Adicionar
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  const fs = e.target.files;
                  e.currentTarget.value = "";
                  if (fs && fs.length) onFiles(fs);
                }}
              />
            </div>

            {attachments.length === 0 ? (
              <button className="ts-att-empty" onClick={() => fileRef.current?.click()}>
                <Icon name="image" size={18} />
                Clique para anexar imagens e arquivos
              </button>
            ) : (
              <div className="ts-att-grid">
                {attachments.map((a) => (
                  <div className="ts-att" key={a.id}>
                    {a.kind === "image" ? (
                      <button
                        className="ts-thumb"
                        style={{ backgroundImage: `url("${a.data}")` }}
                        title={`Baixar ${a.name}`}
                        onClick={() => downloadDataUrl(a.name, a.data)}
                      />
                    ) : (
                      <button
                        className="ts-thumb ts-thumb-file"
                        title={`Baixar ${a.name}`}
                        onClick={() => downloadDataUrl(a.name, a.data)}
                      >
                        <Icon name="paperclip" size={18} />
                      </button>
                    )}
                    <span className="ts-att-nm" title={a.name}>{a.name}</span>
                    <button
                      className="ts-att-x"
                      title="Remover anexo"
                      onClick={() => removeTaskAttachment(task.id, a.id)}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="ts-aside">
            <div className="ts-prop">
              <span className="k">Responsável</span>
              <select
                className="input"
                value={task.assignee_id ?? ""}
                onChange={(e) => updateTask(task.id, { assignee_id: e.target.value || null })}
              >
                <option value="">Sem responsável</option>
                {db.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="ts-prop">
              <span className="k">Fase</span>
              <select
                className="input"
                value={phaseOf(task, ev)}
                onChange={(e) => updateTask(task.id, { phase: e.target.value as TaskPhase })}
              >
                {PHASE_META.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="ts-prop">
              <span className="k">Grupo</span>
              <input
                className="input"
                list="ts-groups"
                defaultValue={task.group}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== task.group) updateTask(task.id, { group: v });
                }}
              />
              <datalist id="ts-groups">
                {groups.map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
            <div className="ts-prop">
              <span className="k">Prazo</span>
              <input
                className="input"
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
              />
            </div>

            <div className="nx-context">
              <div className="nx-head"><span className="sb-mark" />Contexto Nexo</div>

              {delta ? (
                <div className="nx-dx-row">
                  <span className="nx-dx">{delta.dx}</span>
                  <div className="nx-dx-meta">
                    <b>{delta.sub}</b>
                    <span>
                      {dueLeft == null
                        ? ""
                        : dueLeft < 0
                          ? `${-dueLeft} ${-dueLeft === 1 ? "dia" : "dias"} em atraso`
                          : dueLeft === 0
                            ? "vence hoje"
                            : `faltam ${dueLeft} ${dueLeft === 1 ? "dia" : "dias"}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="nx-hint">Defina um prazo para ver a posição na linha do tempo do evento.</div>
              )}

              <div className="nx-divider" />

              <span className="k">Custo no orçamento</span>
              {linkedTx ? (
                <div className="nx-linked">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="lbl">Lançado no financeiro</span>
                    <Badge tone={PAYMENT_META[linkedTx.payment_status]?.tone}>
                      {PAYMENT_META[linkedTx.payment_status]?.label ?? linkedTx.payment_status}
                    </Badge>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 7 }}>
                    <b className="amt">{fmtMoney(linkedTx.amount)}</b>
                    <a className="nx-link" onClick={openFinance}>Ver no financeiro →</a>
                  </div>
                </div>
              ) : task.finance_tx_id ? (
                <>
                  <div className="nx-hint">O lançamento ligado foi removido do financeiro.</div>
                  <button
                    className="btn btn-sm"
                    style={{ width: "100%", marginTop: 8 }}
                    onClick={() => unlinkTaskFinance(task.id)}
                  >
                    Lançar novamente
                  </button>
                </>
              ) : (
                <>
                  <div onBlur={saveCost}>
                    <MoneyInput cents={costCents} onCents={setCostCents} />
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: "100%", marginTop: 8 }}
                    disabled={costCents <= 0}
                    onClick={lancar}
                  >
                    <Icon name="wallet" size={14} />Lançar no financeiro
                  </button>
                  <p className="nx-note">
                    A tarefa alimenta o orçamento do evento — só no Nexo o checklist
                    conversa com o financeiro.
                  </p>
                </>
              )}
            </div>

            {assignee && (
              <div className="ts-assignee-foot">
                Atribuída a <b>{assignee.name}</b>
              </div>
            )}
            <button
              className="btn btn-sm ts-delete"
              onClick={() => {
                removeTask(task.id);
                toast("Tarefa excluída");
                onClose();
              }}
            >
              <Icon name="trash" size={14} />Excluir tarefa
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
