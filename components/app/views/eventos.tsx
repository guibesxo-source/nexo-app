"use client";

/* Eventos — FR-B1/B2: criar, listar e acompanhar eventos do workspace. */
import { useState } from "react";
import { Avatar, Badge, ConfirmDialog, Empty, Icon, Menu, PageHead, useToast } from "@/components/app/kit";
import { EventFormModal } from "@/components/app/event-form";
import { useGo, useUi } from "@/components/app/shell";
import {
  attendeesOf,
  deleteEvent,
  EVENT_PRIORITY_META,
  EVENT_STATUS_META,
  memberById,
  priorityOf,
  saveNow,
  selectEvent,
  tasksOf,
  updateEvent,
  useDb,
} from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { Event, EventPriority } from "@/types";

const FILTERS: [string, string][] = [
  ["todos", "Todos"],
  ["confirmado", "Ativos"],
  ["planejamento", "Planejamento"],
  ["rascunho", "Rascunhos"],
  ["encerrado", "Encerrados"],
];

const PRIORITIES: EventPriority[] = ["alta", "media", "baixa"];

/** Seções da lista: online × presencial (híbrido e sem formato à parte). */
const FORMAT_SECTIONS: [string, string][] = [
  ["online", "Online"],
  ["presencial", "Presenciais"],
  ["hibrido", "Híbridos"],
  ["indefinido", "Formato a definir"],
];

export function Eventos() {
  const db = useDb();
  const go = useGo();
  const toast = useToast();
  const { openNewEvent } = useUi();
  const [filter, setFilter] = useState("todos");
  const [prio, setPrio] = useState<EventPriority | null>(null);
  const [editing, setEditing] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [confirmSelect, setConfirmSelect] = useState<Event | null>(null);

  const countOf = (id: string) =>
    id === "todos" ? db.events.length : db.events.filter((e) => e.status === id).length;

  // Prioridade filtra em cima do status já escolhido (dimensões combinam).
  const byStatus = db.events.filter((e) => filter === "todos" || e.status === filter);
  const prioCount = (p: EventPriority) => byStatus.filter((e) => priorityOf(e) === p).length;
  const list = byStatus.filter((e) => !prio || priorityOf(e) === prio);
  const sections = FORMAT_SECTIONS
    .map(([key, label]) => ({ key, label, events: list.filter((e) => (e.format ?? "indefinido") === key) }))
    .filter((s) => s.events.length > 0);
  const totalAttendees = db.attendees.filter((a) => a.status !== "cancelado").length;

  // Trocar o evento ativo muda dashboard/inscritos/checklist/financeiro:
  // confirma antes (a navegação real acontece no onConfirm do diálogo).
  const open = (ev: Event) => setConfirmSelect(ev);

  return (
    <div className="view">
      <PageHead
        title="Eventos"
        sub={`${db.events.length} evento${db.events.length === 1 ? "" : "s"} · ${totalAttendees} inscritos no total`}
        actions={
          <>
            <button
              className="btn"
              title="Os dados já salvam sozinhos na sua conta a cada alteração — isso força um salvamento agora"
              onClick={() =>
                toast(saveNow() ? "Tudo salvo na sua conta" : "Não foi possível salvar agora")
              }
            >
              <Icon name="save" size={15} />Salvar
            </button>
            <button className="btn btn-primary" onClick={openNewEvent}>
              <Icon name="plus" size={15} />Novo evento
            </button>
          </>
        }
      />

      <div className="row" style={{ marginBottom: 20, gap: 8, flexWrap: "wrap" }}>
        {FILTERS.filter(([id]) => id === "todos" || countOf(id) > 0).map(([id, label]) => (
          <button
            key={id}
            className={"chip" + (filter === id ? " active" : "")}
            onClick={() => setFilter(id)}
          >
            {label}
            <span className="ct">{countOf(id)}</span>
          </button>
        ))}
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
        {PRIORITIES.filter((p) => prioCount(p) > 0).map((p) => (
          <button
            key={p}
            className={"chip" + (prio === p ? " active" : "")}
            title={prio === p ? "Limpar filtro de prioridade" : `Só eventos de prioridade ${EVENT_PRIORITY_META[p].label.toLowerCase()}`}
            onClick={() => setPrio(prio === p ? null : p)}
          >
            {EVENT_PRIORITY_META[p].label}
            <span className="ct">{prioCount(p)}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty
          icon="calendar"
          title="Nenhum evento por aqui"
          sub="Crie seu primeiro evento para começar a gerenciar inscritos, checklist e financeiro."
          action={
            <button className="btn btn-primary" onClick={openNewEvent}>
              <Icon name="plus" size={15} />Criar evento
            </button>
          }
        />
      ) : (
        sections.map((sec) => (
          <div key={sec.key}>
            <div className="task-group-head" style={{ marginTop: 0 }}>
              <span className="tg-title">{sec.label}</span>
              <span className="tg-count">{sec.events.length}</span>
              <span className="tg-line" />
            </div>
            <div className="evlist" style={{ marginBottom: 18 }}>
          {sec.events.map((ev) => {
            const reg = attendeesOf(db, ev.id).filter((a) => a.status !== "cancelado").length;
            const team = [
              ...new Set(
                tasksOf(db, ev.id)
                  .map((t) => t.assignee_id)
                  .filter((id): id is string => !!id)
              ),
            ];
            const meta = EVENT_STATUS_META[ev.status];
            const pr = priorityOf(ev);
            return (
              <div className="evcard" key={ev.id} onClick={() => open(ev)}>
                <div className="evcard-cover" style={{ backgroundImage: ev.cover }}>
                  <span className="evcard-status" style={{ display: "flex", gap: 6 }}>
                    <Badge tone={meta.tone} dot>{meta.label}</Badge>
                    {pr !== "media" && (
                      <Badge tone={EVENT_PRIORITY_META[pr].tone} dot>
                        {EVENT_PRIORITY_META[pr].label}
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="evcard-body">
                  <div className="nm">{ev.name}</div>
                  <div className="meta">
                    <span className="row" style={{ gap: 5 }}>
                      <Icon name="calendar" size={13} />{fmtDate(ev.starts_at)}
                    </span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span className="row" style={{ gap: 5 }}>
                      <Icon name="mapPin" size={13} />{ev.location}
                    </span>
                  </div>
                </div>
                <div className="evcard-foot">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{reg} / {ev.capacity}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>inscritos</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="avatar-stack">
                      {team.slice(0, 3).map((id) => {
                        const m = memberById(db, id);
                        return m && <Avatar key={id} initials={m.initials} size="sm" />;
                      })}
                      {team.length > 3 && <span className="avatar sm more">+{team.length - 3}</span>}
                    </div>
                    <button
                      className="row-action"
                      title="Editar evento"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(ev);
                      }}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="row-action danger"
                      title="Excluir evento"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(ev);
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                    <Menu
                      items={[
                        { label: "Abrir visão geral", onClick: () => open(ev) },
                        { label: "Editar", onClick: () => setEditing(ev) },
                        ...(ev.status !== "encerrado"
                          ? [{
                              label: "Encerrar evento",
                              onClick: () => {
                                updateEvent(ev.id, { status: "encerrado" });
                                toast("Evento encerrado");
                              },
                            }]
                          : []),
                        {
                          label: "Excluir",
                          danger: true,
                          onClick: () => setConfirmDelete(ev),
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        ))
      )}

      {editing && <EventFormModal event={editing} onClose={() => setEditing(null)} />}

      {confirmDelete && (
        <ConfirmDialog
          tone="danger"
          icon="trash"
          title={`Excluir "${confirmDelete.name}"?`}
          message="Isso remove o evento e todos os inscritos, tarefas e lançamentos dele. Esta ação não pode ser desfeita."
          confirmLabel="Excluir evento"
          onConfirm={() => {
            deleteEvent(confirmDelete.id);
            toast("Evento excluído");
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmSelect && (
        <ConfirmDialog
          tone="primary"
          icon="calendar"
          title={`Abrir "${confirmSelect.name}"?`}
          message="O Nexo vai trocar o evento ativo — dashboard, inscritos, checklist e financeiro passam a mostrar os dados deste evento."
          confirmLabel="Abrir evento"
          onConfirm={() => {
            selectEvent(confirmSelect.id);
            go("dashboard");
          }}
          onCancel={() => setConfirmSelect(null)}
        />
      )}
    </div>
  );
}
