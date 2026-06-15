"use client";

/* Conectar ao Sympla e sincronizar inscritos para o evento ativo. */
import { useState } from "react";
import { Badge, Field, Icon, Modal, useToast } from "@/components/app/kit";
import { callSympla, syncSymplaEvent } from "@/components/app/sympla-sync";
import { setSymplaToken, useDb } from "@/lib/db";
import type { SymplaEvent } from "@/lib/integrations/sympla";
import { fmtDate } from "@/lib/format";

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
      setError("Cole o token da API do Sympla (Minha conta > Integrações).");
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
    const sid = String(se.id);
    setBusy(sid);
    setError("");
    try {
      const result = await syncSymplaEvent({
        eventId,
        token: token.trim(),
        symplaEventId: sid,
        symplaEventName: se.name,
      });
      if (result.remote > 0 && result.added + result.updated === 0 && result.invalid === result.remote) {
        setError("Esse evento do Sympla não tem participantes com email válido.");
        return;
      }
      toast(
        result.added > 0 || result.updated > 0
          ? `${result.added} novo${result.added === 1 ? "" : "s"} · ${result.updated} atualizado${result.updated === 1 ? "" : "s"} do Sympla` +
            (result.invalid > 0 ? ` · ${result.invalid} sem email válido` : "")
          : "Participantes do Sympla já sincronizados"
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
      title="Sincronizar inscritos do Sympla"
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Os participantes do evento escolhido entram como inscritos de <b>{eventName}</b>.
        O Nexo usa o identificador do ingresso/participante do Sympla, então compras com o
        mesmo email contam como participantes diferentes.
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
                {busy === String(se.id) ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!events && (
        <p style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 0 }}>
          O token fica salvo neste navegador. Para gerar um: Sympla &gt; Minha conta &gt;{" "}
          <b>Integrações</b> &gt; API Sympla.
        </p>
      )}
    </Modal>
  );
}
