"use client";

/* Conectar ao Sympla e sincronizar inscritos para o evento ativo. */
import { useState } from "react";
import { Badge, Field, Icon, Modal, useToast } from "@/components/app/kit";
import { SymplaFieldPicker } from "@/components/app/sympla-field-picker";
import {
  callSympla,
  loadSymplaParticipants,
  syncSymplaParticipants,
} from "@/components/app/sympla-sync";
import { setSymplaToken, useDb } from "@/lib/db";
import {
  defaultSymplaFieldKeys,
  discoverSymplaFields,
  type SymplaEvent,
  type SymplaFieldOption,
  type SymplaParticipant,
} from "@/lib/integrations/sympla";
import { fmtDate } from "@/lib/format";

type PreparedImport = {
  event: SymplaEvent;
  participants: SymplaParticipant[];
  fields: SymplaFieldOption[];
  selected: string[];
};

export function SymplaImportModal({ eventId, eventName, onClose }: {
  eventId: string; eventName: string; onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [token, setToken] = useState(db.settings.sympla_token ?? "");
  const [events, setEvents] = useState<SymplaEvent[] | null>(null);
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [busy, setBusy] = useState<"connect" | string | null>(null);
  const [error, setError] = useState("");

  const connect = async () => {
    const t = token.trim();
    if (t.length < 8) {
      setError("Cole o token da API do Sympla (Minha conta > Integracoes).");
      return;
    }
    setBusy("connect");
    setError("");
    try {
      const data = (await callSympla({ resource: "events", token: t })) as SymplaEvent[];
      setSymplaToken(t);
      setEvents(data);
      setPrepared(null);
      if (data.length === 0) setError("Conectado, mas nenhum evento foi encontrado nessa conta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar");
    } finally {
      setBusy(null);
    }
  };

  const prepareFrom = async (se: SymplaEvent) => {
    const sid = String(se.id);
    setBusy(`prep:${sid}`);
    setError("");
    try {
      const participants = await loadSymplaParticipants(token.trim(), sid);
      setPrepared({
        event: se,
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
      const result = await syncSymplaParticipants({
        eventId,
        symplaEventId: sid,
        symplaEventName: prepared.event.name,
        participants: prepared.participants,
        fieldKeys: prepared.selected,
      });
      if (result.remote > 0 && result.added + result.updated === 0 && result.invalid === result.remote) {
        setError("Esse evento do Sympla nao tem participantes com email valido.");
        return;
      }
      toast(
        result.added > 0 || result.updated > 0
          ? `${result.added} novo${result.added === 1 ? "" : "s"} · ${result.updated} atualizado${result.updated === 1 ? "" : "s"} do Sympla` +
            (result.invalid > 0 ? ` · ${result.invalid} sem email valido` : "")
          : "Participantes do Sympla ja sincronizados"
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
      width={prepared ? 680 : undefined}
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
        Os participantes do evento escolhido entram como inscritos de <b>{eventName}</b>.
        O Nexo usa o identificador do ingresso/participante do Sympla, entao compras com o
        mesmo email contam como participantes diferentes.
      </p>

      {!prepared && (
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
      )}

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
                onClick={() => prepareFrom(se)}
                disabled={busy !== null}
              >
                {busy === `prep:${String(se.id)}` ? "Carregando..." : "Escolher campos"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!prepared && !events && (
        <p style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 0 }}>
          O token fica salvo neste navegador. Para gerar um: Sympla &gt; Minha conta &gt;{" "}
          <b>Integracoes</b> &gt; API Sympla.
        </p>
      )}
    </Modal>
  );
}
