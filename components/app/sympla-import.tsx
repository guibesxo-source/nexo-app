"use client";

/* Conectar ao Sympla e puxar inscritos — fluxo em dois passos: token →
   lista de eventos do Sympla → importar participantes para o evento ativo.
   A chamada à API passa pelo proxy /api/sympla (token no header, sem CORS). */
import { useState } from "react";
import { Badge, Field, Icon, Modal, useToast } from "@/components/app/kit";
import { importAttendees, setSymplaToken, useDb, type AttendeeDraft } from "@/lib/db";
import { attendeeSchema } from "@/lib/validations/attendee";
import { mapTicket } from "@/components/app/import-attendees";
import { fmtDate } from "@/lib/format";

type SymplaEvent = {
  id: number | string;
  name?: string;
  start_date?: string;
  published?: number | boolean;
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

export function SymplaImportModal({ eventId, eventName, onClose }: {
  eventId: string; eventName: string; onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [token, setToken] = useState(db.settings.sympla_token ?? "");
  const [events, setEvents] = useState<SymplaEvent[] | null>(null);
  const [busy, setBusy] = useState<"connect" | string | null>(null);
  const [error, setError] = useState("");

  const connect = async () => {
    const t = token.trim();
    if (t.length < 8) {
      setError("Cole o token da API do Sympla (Minha conta → Integrações).");
      return;
    }
    setBusy("connect");
    setError("");
    try {
      const data = (await callSympla({ resource: "events", token: t })) as SymplaEvent[];
      setSymplaToken(t);
      setEvents(data);
      if (data.length === 0) setError("Conectado, mas nenhum evento foi encontrado nessa conta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar");
    } finally {
      setBusy(null);
    }
  };

  const importFrom = async (se: SymplaEvent) => {
    setBusy(String(se.id));
    setError("");
    try {
      const participants = (await callSympla({
        resource: "participants",
        token: token.trim(),
        eventId: String(se.id),
      })) as SymplaParticipant[];
      const drafts = toDrafts(participants);
      if (drafts.length === 0) {
        setError("Esse evento do Sympla não tem participantes com email válido.");
        return;
      }
      const { added, skipped } = importAttendees(eventId, drafts);
      toast(
        added > 0
          ? `${added} inscrito${added === 1 ? "" : "s"} puxado${added === 1 ? "" : "s"} do Sympla` +
            (skipped > 0 ? ` · ${skipped} já existia${skipped === 1 ? "" : "m"}` : "")
          : "Todos os participantes do Sympla já estavam na lista"
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Puxar inscritos do Sympla"
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Os participantes do evento escolhido entram como inscritos de <b>{eventName}</b>.
        Emails repetidos são pulados — dá para rodar de novo para sincronizar.
      </p>

      <Field label="Token da API do Sympla">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            type="password"
            placeholder="Cole o token aqui"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus={!token}
          />
          <button
            className="btn btn-dark"
            onClick={connect}
            disabled={busy !== null}
            style={{ flexShrink: 0 }}
          >
            <Icon name="link" size={15} />
            {busy === "connect" ? "Conectando..." : events ? "Atualizar" : "Conectar"}
          </button>
        </div>
      </Field>

      {error && <p className="field-err" style={{ marginTop: 0 }}>{error}</p>}

      {events && events.length > 0 && (
        <div className="sympla-list">
          {events.map((se) => (
            <div className="sympla-row" key={String(se.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{se.name ?? `Evento #${se.id}`}</div>
                <div className="sub">
                  {se.start_date ? fmtDate(se.start_date.slice(0, 10)) : "sem data"}
                  {se.published !== undefined && (
                    <> · <Badge tone={se.published ? "green" : "gray"}>{se.published ? "publicado" : "rascunho"}</Badge></>
                  )}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => importFrom(se)}
                disabled={busy !== null}
              >
                {busy === String(se.id) ? "Importando..." : "Importar inscritos"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!events && (
        <p style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 0 }}>
          O token fica salvo neste navegador. Para gerar um: Sympla → Minha conta →{" "}
          <b>Integrações</b> → API Sympla.
        </p>
      )}
    </Modal>
  );
}
