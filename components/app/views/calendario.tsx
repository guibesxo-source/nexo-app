"use client";

/* Calendário — grade mensal com todos os eventos do workspace ("no radar")
   e notas livres por dia (persistidas em settings.day_notes via @/lib/db). */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Icon, Modal, PageHead, useToast } from "@/components/app/kit";
import { useUi } from "@/components/app/shell";
import { EVENT_STATUS_META, setDayNote, useDb } from "@/lib/db";
import type { Event } from "@/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_LONG = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Chave local YYYY-MM-DD (evita o deslocamento de fuso do toISOString). */
function dayKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Data ISO (com ou sem hora) → chave local do dia. */
function eventDayKey(iso: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? "" : dayKey(d);
}

function fmtFullDate(key: string): string {
  const d = new Date(key + "T00:00:00");
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

function eventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return hh === "00" && mm === "00" ? "" : `${hh}h${mm}`;
}

export function Calendario() {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const { openNewEvent } = useUi();

  const today = new Date();
  const todayKey = dayKey(today);
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [openDay, setOpenDay] = useState<string | null>(null);

  const notes = db.settings.day_notes ?? {};

  // Eventos agrupados por dia (chave local), ordenados por horário.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of db.events) {
      const key = eventDayKey(ev.starts_at);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), ev]);
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [db.events]);

  // Células do mês — semana começa no domingo, completando semanas inteiras.
  const cells = useMemo(() => {
    const startDow = new Date(cursor.y, cursor.m, 1).getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const weeks = Math.ceil((startDow + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) =>
      new Date(cursor.y, cursor.m, 1 - startDow + i)
    );
  }, [cursor]);

  const total = db.events.length;
  const monthEvents = cells.reduce(
    (sum, d) => (d.getMonth() === cursor.m ? sum + (eventsByDay.get(dayKey(d))?.length ?? 0) : sum),
    0
  );

  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => setCursor({ y: today.getFullYear(), m: today.getMonth() });

  return (
    <div className="view">
      <PageHead
        title="Calendário"
        sub={`${total} evento${total === 1 ? "" : "s"} no radar · ${monthEvents} neste mês`}
        actions={
          <button className="btn btn-primary" onClick={openNewEvent}>
            <Icon name="plus" size={15} />Novo evento
          </button>
        }
      />

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="cal-navbtn" onClick={() => move(-1)} title="Mês anterior" aria-label="Mês anterior">
            <Icon name="chevLeft" size={18} />
          </button>
          <button className="cal-navbtn" onClick={() => move(1)} title="Próximo mês" aria-label="Próximo mês">
            <Icon name="chevRight" size={18} />
          </button>
          <h2 className="cal-title">
            {MONTHS[cursor.m]} <span>{cursor.y}</span>
          </h2>
        </div>
        <button className="btn" onClick={goToday}>
          <Icon name="calendarDays" size={15} />Hoje
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
        ))}
        {cells.map((d) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === cursor.m;
          const evs = eventsByDay.get(key) ?? [];
          const hasNote = !!notes[key];
          return (
            <button
              key={key}
              type="button"
              className={
                "cal-cell" + (inMonth ? "" : " out") + (key === todayKey ? " today" : "")
              }
              onClick={() => setOpenDay(key)}
            >
              <span className="cal-cell-top">
                <span className="cal-daynum">{d.getDate()}</span>
                {hasNote && (
                  <span className="cal-note-flag" title="Tem uma nota">
                    <Icon name="note" size={12} />
                  </span>
                )}
              </span>
              <span className="cal-evs">
                {evs.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className="cal-ev"
                    title={ev.name}
                    style={{ backgroundImage: ev.cover }}
                  >
                    {ev.name}
                  </span>
                ))}
                {evs.length > 3 && <span className="cal-more">+{evs.length - 3} eventos</span>}
              </span>
            </button>
          );
        })}
      </div>

      {openDay && (
        <DayPanel
          dateKey={openDay}
          events={eventsByDay.get(openDay) ?? []}
          note={notes[openDay] ?? ""}
          onOpenEvent={(id) => router.push("/events/" + id)}
          onClose={() => setOpenDay(null)}
          onSaved={toast}
        />
      )}
    </div>
  );
}

function DayPanel({
  dateKey, events, note, onOpenEvent, onClose, onSaved,
}: {
  dateKey: string;
  events: Event[];
  note: string;
  onOpenEvent: (id: string) => void;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const dirty = draft.trim() !== note.trim();

  const save = () => {
    setDayNote(dateKey, draft);
    onSaved(draft.trim() ? "Nota salva" : "Nota removida");
    onClose();
  };

  return (
    <Modal
      title={fmtFullDate(dateKey)}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty}>
            <Icon name="save" size={15} />Salvar nota
          </button>
        </>
      }
    >
      <div className="cal-day-sec">
        <div className="cal-day-label">
          {events.length > 0 ? `Eventos do dia (${events.length})` : "Eventos do dia"}
        </div>
        {events.length === 0 ? (
          <div className="cal-day-empty">Nenhum evento agendado neste dia.</div>
        ) : (
          <div className="cal-day-events">
            {events.map((ev) => {
              const meta = EVENT_STATUS_META[ev.status];
              const time = eventTime(ev.starts_at);
              return (
                <button
                  key={ev.id}
                  type="button"
                  className="cal-day-ev"
                  onClick={() => onOpenEvent(ev.id)}
                >
                  <span className="cal-day-ev-cover" style={{ backgroundImage: ev.cover }} />
                  <span className="cal-day-ev-main">
                    <span className="cal-day-ev-nm">{ev.name}</span>
                    <span className="cal-day-ev-sub">
                      {[time, ev.location].filter(Boolean).join(" · ") || "Sem local"}
                    </span>
                  </span>
                  <Badge tone={meta.tone} dot>{meta.label}</Badge>
                  <Icon name="chevRight" size={14} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="cal-day-sec">
        <div className="cal-day-label">Nota do dia</div>
        <textarea
          className="input cal-note-area"
          placeholder="Escreva um lembrete para este dia…"
          value={draft}
          autoFocus={events.length === 0}
          onChange={(e) => setDraft(e.target.value)}
        />
        {note && (
          <button type="button" className="cal-note-clear" onClick={() => setDraft("")}>
            <Icon name="trash" size={13} />Limpar nota
          </button>
        )}
      </div>
    </Modal>
  );
}
