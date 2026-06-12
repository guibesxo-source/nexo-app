"use client";

/* Visão geral de um evento específico (/events/[id]) — reusa o Dashboard
   e sincroniza o evento ativo da sidebar. */
import { useEffect } from "react";
import { Empty, Icon } from "@/components/app/kit";
import { Dashboard } from "@/components/app/views/dashboard";
import { useGo } from "@/components/app/shell";
import { eventById, selectEvent, useDb } from "@/lib/db";

export function EventOverview({ eventId }: { eventId: string }) {
  const db = useDb();
  const go = useGo();
  const ev = eventById(db, eventId);

  useEffect(() => {
    if (ev && db.session.selected_event_id !== ev.id) selectEvent(ev.id);
  }, [ev, db.session.selected_event_id]);

  if (!ev) {
    return (
      <div className="view">
        <Empty
          icon="calendar"
          title="Evento não encontrado"
          sub="Ele pode ter sido excluído ou o link está incorreto."
          action={
            <button className="btn btn-primary" onClick={() => go("eventos")}>
              <Icon name="calendar" size={15} />Ver todos os eventos
            </button>
          }
        />
      </div>
    );
  }

  return <Dashboard eventId={eventId} />;
}
