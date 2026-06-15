"use client";

/* Importar eventos do Sympla (nível workspace) — puxa os eventos da conta e,
   para cada um, deixa escolher: criar um evento novo no Nexo (já com os
   participantes) ou linkar a um evento existente (importa os participantes
   nele). Passa pelo proxy /api/sympla. */
import { useEffect, useState } from "react";
import { Badge, Icon, Modal, useToast } from "@/components/app/kit";
import { createEvent, importAttendees, useDb, type AttendeeDraft } from "@/lib/db";
import { attendeeSchema } from "@/lib/validations/attendee";
import { mapTicket } from "@/components/app/import-attendees";
import { fmtDate } from "@/lib/format";

type SymplaEvent = {
  id: number | string;
  name?: string;
  start_date?: string;
  published?: number | boolean;
  address?: { city?: string; name?: string } | null;
};

type SymplaParticipant = {
  first_name?: string;
  last_name?: string;
  email?: string;
  ticket_name?: string;
  checkin?: { check_in?: boolean | number };
};

async function callSympla(body: Record<string, string>): Promise<unknown[]> {
  const res = await fetch("/api/sympla", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown[]; error?: string } | null;
  if (!res.ok || !json?.data) throw new Error(json?.error ?? "Falha ao falar com o Sympla");
  return json.data;
}

function toDrafts(participants: SymplaParticipant[]): AttendeeDraft[] {
  const drafts: AttendeeDraft[] = [];
  for (const p of participants) {
    const parsed = attendeeSchema.safeParse({
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      email: p.email ?? "",
      company: "",
      ticket: mapTicket(p.ticket_name ?? ""),
      status: p.checkin?.check_in ? "checkin" : "confirmado",
    });
    if (parsed.success) drafts.push(parsed.data);
  }
  return drafts;
}

/** Data do Sympla ("YYYY-MM-DD HH:mm:ss" ou ISO) → ISO; hoje se inválida. */
function toIso(start?: string): string {
  if (!start) return new Date().toISOString();
  const d = new Date(start.includes("T") ? start : start.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function SymplaEventsModal({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const token = db.settings.sympla_token ?? "";

  const [events, setEvents] = useState<SymplaEvent[] | null>(null);
  // alvo por evento do Sympla: "new" (criar) ou id de um evento existente do Nexo
  const [target, setTarget] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"load" | string | null>("load");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = (await callSympla({ resource: "events", token })) as SymplaEvent[];
        if (!active) return;
        setEvents(data);
        if (data.length === 0) setError("Conectado, mas nenhum evento foi encontrado nessa conta.");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Falha ao carregar eventos");
      } finally {
        if (active) setBusy(null);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const importFrom = async (se: SymplaEvent) => {
    const sid = String(se.id);
    const tgt = target[sid] || "new";
    setBusy(sid);
    setError("");
    try {
      const participants = (await callSympla({
        resource: "participants",
        token,
        eventId: sid,
      })) as SymplaParticipant[];
      const drafts = toDrafts(participants);
      if (drafts.length === 0) {
        setError(`"${se.name ?? "Evento"}" não tem participantes com email válido.`);
        return;
      }

      let eventId = tgt;
      let where = "";
      if (tgt === "new") {
        eventId = createEvent({
          name: se.name ?? `Evento Sympla ${sid}`,
          status: "planejamento",
          starts_at: toIso(se.start_date),
          location: se.address?.city ?? se.address?.name ?? "—",
          capacity: 0,
          budget_planned: 0,
        });
        where = "novo evento no Nexo";
      } else {
        where = db.events.find((e) => e.id === tgt)?.name ?? "evento";
      }

      const { added, skipped } = importAttendees(eventId, drafts);
      toast(
        `${added} inscrito${added === 1 ? "" : "s"} · ${tgt === "new" ? where : `para ${where}`}` +
          (skipped > 0 ? ` (${skipped} repetido${skipped === 1 ? "" : "s"})` : "")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Importar eventos do Sympla"
      onClose={onClose}
      width={560}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Para cada evento do Sympla, crie um evento novo no Nexo (já com os participantes) ou
        importe os participantes para um evento que você já tem. Emails repetidos são pulados.
      </p>

      {busy === "load" && <p style={{ fontSize: 13, color: "var(--dim)" }}>Carregando eventos…</p>}
      {error && <p className="field-err" style={{ marginTop: 0 }}>{error}</p>}

      {events && events.length > 0 && (
        <div className="sympla-ev-list">
          {events.map((se) => {
            const sid = String(se.id);
            return (
              <div className="sympla-ev" key={sid}>
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{se.name ?? `Evento #${sid}`}</div>
                  <div className="sub">
                    {se.start_date ? fmtDate(se.start_date.slice(0, 10)) : "sem data"}
                    {se.published !== undefined && (
                      <> · <Badge tone={se.published ? "green" : "gray"}>{se.published ? "publicado" : "rascunho"}</Badge></>
                    )}
                  </div>
                </div>
                <div className="sympla-ev-act">
                  <select
                    className="input"
                    value={target[sid] || "new"}
                    onChange={(e) => setTarget((t) => ({ ...t, [sid]: e.target.value }))}
                    disabled={busy !== null}
                  >
                    <option value="new">➕ Criar evento no Nexo</option>
                    {db.events.length > 0 && <option disabled>── linkar a existente ──</option>}
                    {db.events.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => importFrom(se)}
                    disabled={busy !== null}
                    style={{ flexShrink: 0 }}
                  >
                    {busy === sid ? "..." : "Importar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0 }}>
        <Icon name="bolt" size={13} /> Eventos novos entram como “planejamento” — depois é só
        ajustar capacidade, orçamento e checklist.
      </p>
    </Modal>
  );
}
