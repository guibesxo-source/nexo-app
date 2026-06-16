"use client";

/* Importar eventos do Sympla e vincular cada um ao evento Nexo correspondente. */
import { useEffect, useState } from "react";
import { Badge, Icon, Modal, useToast } from "@/components/app/kit";
import { SymplaFieldPicker } from "@/components/app/sympla-field-picker";
import {
  callSympla,
  loadSymplaParticipants,
  syncSymplaParticipants,
} from "@/components/app/sympla-sync";
import { createEvent, useDb } from "@/lib/db";
import {
  defaultSymplaFieldKeys,
  discoverSymplaFields,
  type SymplaEvent,
  type SymplaFieldOption,
  type SymplaParticipant,
} from "@/lib/integrations/sympla";
import { fmtDate } from "@/lib/format";

type PreparedEventImport = {
  event: SymplaEvent;
  targetId: string;
  participants: SymplaParticipant[];
  fields: SymplaFieldOption[];
  selected: string[];
};

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
  const [target, setTarget] = useState<Record<string, string>>({});
  const [prepared, setPrepared] = useState<PreparedEventImport | null>(null);
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

  const prepareFrom = async (se: SymplaEvent) => {
    const sid = String(se.id);
    setBusy(`prep:${sid}`);
    setError("");
    try {
      const participants = await loadSymplaParticipants(token, sid);
      setPrepared({
        event: se,
        targetId: target[sid] || "new",
        participants,
        fields: discoverSymplaFields(participants),
        selected: defaultSymplaFieldKeys(participants),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar participantes");
    } finally {
      setBusy(null);
    }
  };

  const importPrepared = async () => {
    if (!prepared) return;
    const sid = String(prepared.event.id);
    setBusy(`sync:${sid}`);
    setError("");
    try {
      let eventId = prepared.targetId;
      let where = "";
      if (prepared.targetId === "new") {
        eventId = createEvent({
          name: prepared.event.name ?? `Evento Sympla ${sid}`,
          status: "planejamento",
          starts_at: toIso(prepared.event.start_date),
          location: prepared.event.address?.city ?? prepared.event.address?.name ?? "-",
          capacity: 0,
          budget_planned: 0,
        });
        where = "novo evento no Nexo";
      } else {
        where = db.events.find((event) => event.id === prepared.targetId)?.name ?? "evento";
      }

      const result = await syncSymplaParticipants({
        eventId,
        symplaEventId: sid,
        symplaEventName: prepared.event.name,
        participants: prepared.participants,
        fieldKeys: prepared.selected,
      });

      toast(
        `${result.added} novo${result.added === 1 ? "" : "s"} · ${result.updated} atualizado${result.updated === 1 ? "" : "s"} · ` +
          (prepared.targetId === "new" ? where : `para ${where}`) +
          (result.invalid > 0 ? ` (${result.invalid} sem email valido)` : "")
      );
      setPrepared(null);
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
      width={prepared ? 680 : 560}
      footer={
        prepared ? (
          <>
            <button className="btn" onClick={() => setPrepared(null)} disabled={busy !== null}>Voltar</button>
            <button
              className="btn btn-primary"
              onClick={importPrepared}
              disabled={busy !== null || prepared.participants.length === 0}
            >
              {busy === `sync:${String(prepared.event.id)}`
                ? "Sincronizando..."
                : `Importar ${prepared.participants.length} inscritos`}
            </button>
          </>
        ) : (
          <button className="btn" onClick={onClose}>Fechar</button>
        )
      }
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Para cada evento do Sympla, crie um evento novo no Nexo ou vincule a um evento existente.
        Depois escolha os campos que vao alimentar a lista de inscritos.
      </p>

      {busy === "load" && <p style={{ fontSize: 13, color: "var(--dim)" }}>Carregando eventos...</p>}
      {error && <p className="field-err" style={{ marginTop: 0 }}>{error}</p>}

      {prepared && (
        <div className="sympla-config">
          <div className="sympla-config-head">
            <div>
              <div className="nm">{prepared.event.name ?? `Evento #${prepared.event.id}`}</div>
              <div className="sub">
                {prepared.participants.length} participante{prepared.participants.length === 1 ? "" : "s"} encontrado{prepared.participants.length === 1 ? "" : "s"}
                {prepared.fields.length > 0 && <> · {prepared.selected.length} campo{prepared.selected.length === 1 ? "" : "s"} extra{prepared.selected.length === 1 ? "" : "s"}</>}
              </div>
            </div>
          </div>
          <SymplaFieldPicker
            fields={prepared.fields}
            selected={prepared.selected}
            onChange={(selected) => setPrepared((current) => current ? { ...current, selected } : current)}
          />
        </div>
      )}

      {!prepared && events && events.length > 0 && (
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
                    <option value="new">+ Criar evento no Nexo</option>
                    {db.events.length > 0 && <option disabled>-- linkar a existente --</option>}
                    {db.events.map((event) => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => prepareFrom(se)}
                    disabled={busy !== null}
                    style={{ flexShrink: 0 }}
                  >
                    {busy === `prep:${sid}` ? "..." : "Campos"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!prepared && (
        <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0 }}>
          <Icon name="bolt" size={13} /> Eventos novos entram como planejamento; depois ajuste
          capacidade, orcamento e checklist.
        </p>
      )}
    </Modal>
  );
}
