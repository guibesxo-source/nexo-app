"use client";

/* Conectar / gerenciar uma integração — fluxo de nível workspace (não depende
   de evento, diferente dos modais de import). Cola o token, valida de verdade
   contra o proxy do provedor e salva em @/lib/db; permite reconectar/desconectar.
   Quem importa para um evento específico segue sendo a tela de Inscritos. */
import { useState, type ReactNode } from "react";
import { Field, Icon, Modal, useToast } from "@/components/app/kit";

export type IntegrationStatus = "connected" | "available" | "soon";

/** Provedor do catálogo de integrações. Os campos de conexão (tokenLabel…save)
    existem só nos provedores conectáveis (status !== "soon"). */
export type IntegrationProvider = {
  id: string;
  name: string;
  mark: string;
  color: string;
  category: string;
  description: string;
  status: IntegrationStatus;
  tokenLabel?: string;
  placeholder?: string;
  minLen?: number;
  helpText?: ReactNode;
  currentToken?: string | null;
  /** Valida o token contra a API do provedor; lança Error (mensagem do proxy) se falhar. */
  validate?: (token: string) => Promise<{ count: number; noun: string }>;
  save?: (token: string | null) => void;
  /** Chamado após conectar com sucesso (ex.: abrir o fluxo de importação). */
  afterConnect?: () => void;
  /** Ação de importação quando já conectado (botão primário do card). */
  onImport?: () => void;
  importLabel?: string;
};

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function ConnectIntegrationModal({ provider, onClose }: {
  provider: IntegrationProvider;
  onClose: () => void;
}) {
  const toast = useToast();
  const [token, setToken] = useState(provider.currentToken ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Só é aberto para provedores conectáveis; guarda por segurança de tipo.
  const validate = provider.validate;
  const save = provider.save;
  if (!validate || !save) return null;

  const connected = !!provider.currentToken;

  const connect = async () => {
    const t = token.trim();
    if (t.length < (provider.minLen ?? 8)) {
      setError(`Cole o ${provider.tokenLabel ?? "token"} para conectar.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { count, noun } = await validate(t);
      save(t);
      toast(`${provider.name} conectado · ${plural(count, noun)} encontrado${count === 1 ? "" : "s"}`);
      provider.afterConnect?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    save(null);
    toast(`${provider.name} desconectado`);
    onClose();
  };

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 10 }}>
          <span className="integ-logo" style={{ background: provider.color, width: 30, height: 30, fontSize: 12 }}>
            {provider.mark}
          </span>
          {connected ? `Gerenciar ${provider.name}` : `Conectar ao ${provider.name}`}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          {connected && (
            <button
              className="btn"
              style={{ color: "var(--red)", borderColor: "var(--red)", marginRight: "auto" }}
              onClick={disconnect}
              disabled={busy}
            >
              Desconectar
            </button>
          )}
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={connect} disabled={busy}>
            {busy ? "Conectando..." : connected ? "Reconectar" : "Conectar"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        {connected
          ? "Conta conectada neste navegador. Reconecte para trocar o token ou desconecte para remover o acesso."
          : `Cole o token para liberar a importação de inscritos do ${provider.name} na tela de Inscritos.`}
      </p>

      {connected && (
        <div className="import-summary" style={{ marginTop: 0, marginBottom: 16 }}>
          <Icon name="check" size={15} />
          <span><b>{provider.name}</b> conectado</span>
        </div>
      )}

      <Field label={provider.tokenLabel ?? "Token"}>
        <input
          className="input"
          type="password"
          placeholder={provider.placeholder}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && connect()}
          autoFocus={!connected}
        />
      </Field>

      {error && <p className="field-err" style={{ marginTop: 0 }}>{error}</p>}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 6, marginBottom: 0 }}>
        {provider.helpText}
      </p>
    </Modal>
  );
}
