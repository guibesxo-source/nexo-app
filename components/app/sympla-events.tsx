"use client";

/* Importar eventos do Sympla e vincular cada um ao evento Nexo correspondente. */
import { useEffect, useState } from "react";
import { Badge, Icon, Modal, useToast } from "@/components/app/kit";
import { callSympla, syncSymplaEvent } from "@/components/app/sympla-sync";
import { createEvent, useDb } from "@/lib/db";
import type { SymplaEvent } from "@/lib/integrations/sympla";
import { fmtDate } from "@/lib/format";

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
      let eventId = tgt;
      let where = "";
      if (tgt === "new") {
        eventId = createEvent({
          name: se.name ?? `Evento Sympla ${sid}`,
          status: "planejamento",
          starts_at: toIso(se.start_date),
          location: se.address?.city ?? se.address?.name ?? "-",
          capacity: 0,
          budget_planned: 0,
        });
        where = "novo evento no Nexo";
      } else {
        where = db.events.find((e) => e.id === tgt)?.name ?? "evento";
      }

      const result = await syncSymplaEvent({
        eventId,
        token,
        symplaEventId: sid,
        symplaEventName: se.name,
      });

      toast(
        `${result.added} novo${result.added === 1 ? "" : "s"} · ${result.updated} atualizado${result.updated === 1 ? "" : "s"} · ` +
          (tgt === "new" ? where : `para ${where}`) +
          (result.invalid > 0 ? ` (${result.invalid} sem email válido)` : "")
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
        Para cada evento do Sympla, crie um evento novo no Nexo ou vincule a um evento existente.
        Depois do primeiro sync, o dashboard atualiza sozinho enquanto estiver aberto.
      </p>

      {busy === "load" && <p style={{ fontSize: 13, color: "var(--dim)" }}>Carregando eventos...</p>}
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
                    <option value="new">+ Criar evento no Nexo</option>
                    {db.events.length > 0 && <option disabled>-- linkar a existente --</option>}
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
                    {busy === sid ? "..." : "Sincronizar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0 }}>
        <Icon name="bolt" size={13} /> Eventos novos entram como planejamento; depois ajuste
        capacidade, orçamento e checklist.
      </p>
    </Modal>
  );
}
