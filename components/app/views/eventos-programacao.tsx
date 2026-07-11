"use client";

/* Programação — a agenda do evento em blocos (dia + horário), com detecção de
   conflito de horário e exportação pronta para compartilhar com a equipe. */
import { useMemo, useState } from "react";
import {
  Badge, Card, ConfirmDialog, Empty, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import {
  AGENDA_KIND_META,
  addAgendaItem,
  agendaConflicts,
  agendaOf,
  removeAgendaItem,
  selectedEvent,
  updateAgendaItem,
  useDb,
} from "@/lib/db";
import { agendaItemSchema } from "@/lib/validations/operations";
import { fmtDate } from "@/lib/format";
import type { AgendaItem, AgendaKind } from "@/types";

const KINDS = Object.entries(AGENDA_KIND_META) as [AgendaKind, { label: string; tone: string }][];

function AgendaModal({ eventId, item, defaultDay, onClose }: {
  eventId: string; item?: AgendaItem; defaultDay: string; onClose: () => void;
}) {
  const toast = useToast();
  const editing = !!item;
  const [form, setForm] = useState({
    title: item?.title ?? "",
    day: item?.day ?? defaultDay,
    start: item?.start ?? "09:00",
    end: item?.end ?? "",
    speaker: item?.speaker ?? "",
    location: item?.location ?? "",
    kind: item?.kind ?? ("palestra" as AgendaKind),
    notes: item?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const parsed = agendaItemSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    if (editing) {
      updateAgendaItem(eventId, item.id, parsed.data);
      toast("Bloco atualizado");
    } else {
      addAgendaItem(eventId, parsed.data);
      toast("Bloco adicionado à programação");
    }
    onClose();
  };

  return (
    <Modal
      title={editing ? "Editar bloco" : "Novo bloco da programação"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>{editing ? "Salvar" : "Adicionar"}</button>
        </>
      }
    >
      <Field label="Título" error={errors.title}>
        <input
          className="input"
          placeholder="Ex.: Abertura e boas-vindas"
          value={form.title}
          onChange={set("title")}
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Dia" error={errors.day}>
          <input className="input" type="date" value={form.day} onChange={set("day")} />
        </Field>
        <Field label="Tipo" error={errors.kind}>
          <select className="input" value={form.kind} onChange={set("kind")}>
            {KINDS.map(([id, meta]) => (
              <option key={id} value={id}>{meta.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Início" error={errors.start}>
          <input className="input" type="time" value={form.start} onChange={set("start")} />
        </Field>
        <Field label="Fim (opcional)" error={errors.end}>
          <input className="input" type="time" value={form.end} onChange={set("end")} />
        </Field>
        <Field label="Quem apresenta (opcional)" error={errors.speaker}>
          <input className="input" placeholder="Palestrante, banda, host…" value={form.speaker} onChange={set("speaker")} />
        </Field>
        <Field label="Onde (opcional)" error={errors.location}>
          <input className="input" placeholder="Palco, sala, link…" value={form.location} onChange={set("location")} />
        </Field>
      </div>
      <Field label="Notas (opcional)" error={errors.notes}>
        <textarea
          className="input"
          rows={2}
          placeholder="Equipamento, deixas, observações…"
          value={form.notes}
          onChange={set("notes")}
        />
      </Field>
    </Modal>
  );
}

export function EventosProgramacao() {
  const db = useDb();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [removing, setRemoving] = useState<AgendaItem | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const ev = selectedEvent(db);
  const items = useMemo(() => (ev ? agendaOf(db, ev.id) : []), [db, ev]);

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Programação" sub="Nenhum evento criado ainda" />
        <Empty icon="calendarDays" title="Crie um evento primeiro" sub="A programação pertence a um evento." />
      </div>
    );
  }

  const eventDay = ev.starts_at ? ev.starts_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const days = [...new Set(items.map((it) => it.day))].sort();
  const day = activeDay && days.includes(activeDay) ? activeDay : days[0] ?? eventDay;
  const dayItems = items.filter((it) => it.day === day);
  const conflicts = agendaConflicts(dayItems);
  const conflictIds = new Set(conflicts.flat().map((it) => it.id));

  const copyAgenda = async () => {
    const lines = [
      `${ev.name} — Programação`,
      ...days.flatMap((d) => [
        "",
        `📅 ${fmtDate(d)}`,
        ...items
          .filter((it) => it.day === d)
          .map(
            (it) =>
              `${it.start}${it.end ? `–${it.end}` : ""} · ${it.title}` +
              (it.speaker ? ` — ${it.speaker}` : "") +
              (it.location ? ` (${it.location})` : "")
          ),
      ]),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Programação copiada — cole no WhatsApp ou e-mail");
    } catch {
      toast("Não consegui copiar automaticamente");
    }
  };

  return (
    <div className="view">
      <PageHead
        title="Programação"
        sub={`${ev.name} · ${items.length} bloco${items.length === 1 ? "" : "s"}${days.length > 1 ? ` em ${days.length} dias` : ""}`}
        actions={
          <>
            <button className="btn" onClick={copyAgenda} disabled={items.length === 0}>
              <Icon name="note" size={15} />Copiar p/ compartilhar
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} />Novo bloco
            </button>
          </>
        }
      />

      {conflicts.length > 0 && (
        <div className="agenda-warn">
          <Icon name="bolt" size={15} />
          {conflicts.length === 1
            ? `“${conflicts[0][0].title}” e “${conflicts[0][1].title}” estão com horários sobrepostos.`
            : `${conflicts.length} pares de blocos com horários sobrepostos neste dia.`}
        </div>
      )}

      {days.length > 1 && (
        <div className="seg" style={{ marginBottom: 14 }}>
          {days.map((d) => (
            <button key={d} className={d === day ? "active" : ""} onClick={() => setActiveDay(d)}>
              {fmtDate(d)}
            </button>
          ))}
        </div>
      )}

      <Card pad0>
        {items.length === 0 ? (
          <Empty
            icon="calendarDays"
            title="Programação em branco"
            sub="Monte a grade do dia: abertura, palestras, intervalos e encerramento — a equipe inteira vê a mesma agenda."
            action={
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={15} />Primeiro bloco
              </button>
            }
          />
        ) : (
          <div className="agenda-list">
            {dayItems.map((it) => {
              const meta = AGENDA_KIND_META[it.kind];
              return (
                <div className={"agenda-row" + (conflictIds.has(it.id) ? " conflict" : "")} key={it.id}>
                  <span className="agenda-time">
                    <b>{it.start}</b>
                    {it.end && <span>{it.end}</span>}
                  </span>
                  <span className="agenda-rail"><i /></span>
                  <span className="agenda-main">
                    <span className="agenda-top">
                      <span className="agenda-title">{it.title}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {conflictIds.has(it.id) && <Badge tone="red">conflito</Badge>}
                    </span>
                    {(it.speaker || it.location || it.notes) && (
                      <span className="agenda-sub">
                        {[it.speaker, it.location, it.notes].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <Menu
                    items={[
                      { label: "Editar bloco", onClick: () => setEditing(it) },
                      { label: "Excluir bloco", danger: true, onClick: () => setRemoving(it) },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <AgendaModal
          eventId={ev.id}
          item={editing ?? undefined}
          defaultDay={day ?? eventDay}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Excluir “${removing.title}”?`}
          message="O bloco sai da programação do evento."
          confirmLabel="Excluir"
          tone="danger"
          icon="trash"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeAgendaItem(ev.id, removing.id);
            setRemoving(null);
            toast("Bloco excluído");
          }}
        />
      )}
    </div>
  );
}
