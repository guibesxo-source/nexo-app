"use client";

/* Receber inscritos de um formulário HubSpot embedado numa LP, SEM a API do
   HubSpot. Gera um endpoint de webhook por evento (token = segredo da URL) e
   entrega o snippet pronto pra colar na LP. A cada envio do formulário, a LP faz
   POST em /api/ingest/hubspot e o inscrito entra no evento (ver route handler).
   Caminho pensado pra quando o formulário vive num portal sem acesso à API. */
import { useMemo, useState } from "react";
import { Field, Icon, Modal, useToast } from "@/components/app/kit";
import { createHubspotIngest, removeHubspotIngest, useDb } from "@/lib/db";
import { HubspotCsvImportModal } from "@/components/app/hubspot-csv-import";
import { fmtDate } from "@/lib/format";

/** Snippet standalone pra LP: escuta o postMessage do embed do HubSpot e, no
   `onFormSubmit` (antes de limpar os campos), lê os inputs e envia ao Nexo.
   Funciona com qualquer embed do HubSpot (v2/v4) sem mexer no hbspt.forms.create. */
function buildSnippet(url: string, token: string): string {
  return [
    "<!-- Nexo · envia cada submissão do formulário HubSpot para o evento -->",
    "<script>",
    "(function () {",
    '  var NEXO_URL = "' + url + '";',
    '  var NEXO_TOKEN = "' + token + '";',
    "  function collect(form) {",
    "    if (!form) return [];",
    "    return Array.prototype.map.call(",
    '      form.querySelectorAll("input[name], select[name], textarea[name]"),',
    "      function (el) { return { name: el.name, value: el.value }; }",
    "    ).filter(function (f) { return f.name && f.value; });",
    "  }",
    "  function send(fields) {",
    "    if (!fields.length) return;",
    "    try {",
    "      fetch(NEXO_URL, {",
    '        method: "POST",',
    '        headers: { "Content-Type": "application/json" },',
    "        body: JSON.stringify({ token: NEXO_TOKEN, fields: fields, pageUrl: location.href, submittedAt: Date.now() }),",
    "        keepalive: true",
    "      }).catch(function () {});",
    "    } catch (e) {}",
    "  }",
    '  window.addEventListener("message", function (e) {',
    '    if (!e.data || e.data.type !== "hsFormCallback") return;',
    '    if (e.data.eventName !== "onFormSubmit") return; // antes de limpar os campos',
    '    var form = document.querySelector("form.hs-form") || document.querySelector(".hs-form form") || document.querySelector("form");',
    "    send(collect(form));",
    "  });",
    "})();",
    "</script>",
  ].join("\n");
}

export function HubspotWebhookModal({ eventId, eventName, onClose }: {
  eventId: string;
  eventName: string;
  onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [csvOpen, setCsvOpen] = useState(false);
  const endpoint = db.ingestEndpoints.find(
    (e) => e.event_id === eventId && e.provider === "hubspot"
  );

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );
  const url = origin + "/api/ingest/hubspot";
  const snippet = endpoint ? buildSnippet(url, endpoint.token) : "";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(label + " copiado");
    } catch {
      toast("Não consegui copiar — selecione e copie manualmente");
    }
  };

  // Passo de backlog: importar quem já se inscreveu (CSV exportado do HubSpot).
  if (csvOpen) {
    return (
      <HubspotCsvImportModal eventId={eventId} eventName={eventName} onClose={() => setCsvOpen(false)} />
    );
  }

  return (
    <Modal
      title="Receber inscritos via formulário (sem API)"
      onClose={onClose}
      width={620}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Cole o snippet na sua landing page com o formulário do HubSpot. A cada
        envio, o inscrito entra automaticamente em <b>{eventName}</b> — sem usar a
        API do HubSpot. Emails repetidos no evento são ignorados.
      </p>

      {!endpoint ? (
        <button
          className="btn btn-primary"
          onClick={() => {
            createHubspotIngest(eventId);
            toast("Endpoint criado · cole o snippet na sua LP");
          }}
        >
          <Icon name="bolt" size={15} /> Gerar endpoint de recebimento
        </button>
      ) : (
        <>
          <Field label="URL do webhook (POST)">
            <div className="row" style={{ gap: 8 }}>
              <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="btn" style={{ flexShrink: 0 }} onClick={() => copy(url, "URL")}>
                Copiar
              </button>
            </div>
          </Field>

          <Field label="Token (segredo deste evento)">
            <div className="row" style={{ gap: 8 }}>
              <input className="input" readOnly value={endpoint.token} onFocus={(e) => e.target.select()} />
              <button
                className="btn"
                style={{ flexShrink: 0 }}
                onClick={() => copy(endpoint.token, "Token")}
              >
                Copiar
              </button>
            </div>
          </Field>

          <div
            style={{
              background: "var(--surface-2, rgba(127,127,127,0.08))",
              border: "1px solid rgba(127,127,127,0.22)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Como instalar na sua LP</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--dim)", lineHeight: 1.7 }}>
              <li>Abra o <b>HTML da landing page</b> — a mesma página onde está o formulário do HubSpot.</li>
              <li>Cole o snippet abaixo logo <b>antes do <code>&lt;/body&gt;</code></b> (ou no campo de HTML/footer da página).</li>
              <li><b>Publique</b> a LP e faça um envio de teste — o inscrito deve cair neste evento.</li>
            </ol>
            <p style={{ fontSize: 12, color: "var(--dim)", margin: "8px 0 0" }}>
              Não precisa mexer no código do formulário do HubSpot — o snippet escuta o envio sozinho.
            </p>
          </div>

          <Field label="Snippet para colar no HTML da LP">
            <textarea
              className="input"
              readOnly
              rows={9}
              value={snippet}
              onFocus={(e) => e.target.select()}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />
          </Field>
          <button className="btn btn-dark" onClick={() => copy(snippet, "Snippet")}>
            <Icon name="download" size={15} /> Copiar snippet
          </button>

          <div className="import-summary" style={{ marginTop: 16 }}>
            <Icon name="check" size={15} />
            <span>
              <b>{endpoint.received_count}</b> recebido{endpoint.received_count === 1 ? "" : "s"} por
              este endpoint
              {endpoint.last_received_at && <> · último em {fmtDate(endpoint.last_received_at.slice(0, 10))}</>}
            </span>
          </div>

          <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 12 }}>
            Os inscritos aparecem na próxima atualização da tela — recarregue Inscritos para ver os novos.
          </p>

          <button
            className="btn"
            style={{ color: "var(--red)", borderColor: "var(--red)" }}
            onClick={() => {
              removeHubspotIngest(endpoint.token);
              toast("Endpoint revogado");
            }}
          >
            <Icon name="trash" size={15} /> Revogar endpoint
          </button>
        </>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(127,127,127,0.22)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Já tem inscritos no HubSpot?</div>
        <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "0 0 10px" }}>
          O webhook só pega novos envios, daqui pra frente. Para trazer quem <b>já se inscreveu</b>,
          exporte o CSV no HubSpot e importe aqui — mesmo mapeamento, dedup por email.
        </p>
        <button className="btn" onClick={() => setCsvOpen(true)}>
          <Icon name="upload" size={15} /> Importar inscritos atuais (CSV)
        </button>
      </div>
    </Modal>
  );
}
