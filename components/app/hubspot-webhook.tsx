"use client";

/* Receber inscritos de um formulário HubSpot embedado numa LP, SEM a API do
   HubSpot. Gera um endpoint de webhook por evento (token = segredo da URL) e
   entrega o snippet pronto pra colar na LP. A cada envio do formulário, a LP faz
   POST em /api/ingest/hubspot e o inscrito entra no evento (ver route handler).
   Caminho pensado pra quando o formulário vive num portal sem acesso à API.

   UX pensada pra usuário leigo: a ÚNICA coisa que ele precisa é copiar o código
   e colar na página. URL e token (que já vão embutidos no código) ficam escondidos
   atrás de "Detalhes técnicos". Há um teste de conexão ao vivo e um card de
   conclusão que confirma quando a página já está enviando inscritos de verdade. */
import { useEffect, useMemo, useState } from "react";
import { Field, Icon, Modal, useToast } from "@/components/app/kit";
import {
  createHubspotIngest,
  refreshAttendees,
  refreshIngestEndpoints,
  removeHubspotIngest,
  useDb,
} from "@/lib/db";
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
    "  function fromPayload(d) {",
    "    if (Array.isArray(d)) return d;",
    "    if (d && Array.isArray(d.submissionValues)) return d.submissionValues;",
    '    if (d && d.submissionValues && typeof d.submissionValues === "object")',
    "      return Object.keys(d.submissionValues).map(function (k) { return { name: k, value: d.submissionValues[k] }; });",
    "    return [];",
    "  }",
    '  window.addEventListener("message", function (e) {',
    '    if (!e.data || e.data.type !== "hsFormCallback") return;',
    '    if (e.data.eventName !== "onFormSubmit" && e.data.eventName !== "onFormSubmitted") return;',
    "    var fields = fromPayload(e.data.data); // funciona com form em iframe",
    "    if (!fields.length) {", // embed inline: lê os inputs do DOM antes de limpar
    '      var form = document.querySelector("form.hs-form") || document.querySelector(".hs-form form") || document.querySelector("form");',
    "      fields = collect(form);",
    "    }",
    "    send(fields);",
    "  });",
    "})();",
    "</script>",
  ].join("\n");
}

/** Caixa tingida (card de status / aviso) a partir de uma cor hex de 6 dígitos. */
function tint(color: string) {
  return {
    background: color + "14",
    border: "1px solid " + color + "55",
    borderRadius: 12,
    padding: "14px 16px",
  } as const;
}

type TestResult = { ok: boolean; msg: string };

export function HubspotWebhookModal({ eventId, eventName, onClose }: {
  eventId: string;
  eventName: string;
  onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [csvOpen, setCsvOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [checking, setChecking] = useState(false);

  const endpoint = db.ingestEndpoints.find(
    (e) => e.event_id === eventId && e.provider === "hubspot"
  );

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );
  const url = origin + "/api/ingest/hubspot";
  const snippet = endpoint ? buildSnippet(url, endpoint.token) : "";
  const token = endpoint?.token ?? "";
  const liveCount = endpoint?.received_count ?? 0;
  const live = liveCount > 0;

  // Reflete ao vivo o que a LP já mandou: o webhook grava no Postgres e aqui só
  // relemos o endpoint (na abertura e a cada 20s enquanto o modal está aberto).
  useEffect(() => {
    if (!token) return;
    void refreshIngestEndpoints();
    const timer = window.setInterval(() => void refreshIngestEndpoints(), 20000);
    return () => window.clearInterval(timer);
  }, [token]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(label + " copiado");
    } catch {
      toast("Não consegui copiar — selecione e copie manualmente");
    }
  };

  // "Testar conexão": ping com test:true — confirma que o endpoint do Nexo está
  // no ar (token válido, app publicado), sem criar inscrito falso.
  const testConnection = async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, test: true, fields: [] }),
      });
      const json = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      if (res.ok && json?.status === "ok") {
        setTestResult({
          ok: true,
          msg: "Conexão com o Nexo funcionando! Agora faça uma inscrição de teste no formulário da sua página publicada para confirmar de ponta a ponta.",
        });
      } else if (res.status === 404) {
        setTestResult({
          ok: false,
          msg: "O Nexo não reconheceu este código. Gere o código de novo e confirme que o app está publicado.",
        });
      } else {
        setTestResult({
          ok: false,
          msg: json?.error ?? "Não consegui falar com o Nexo. Confira sua internet e tente de novo.",
        });
      }
    } catch {
      setTestResult({ ok: false, msg: "Não consegui falar com o Nexo. Confira sua internet e tente de novo." });
    } finally {
      setTesting(false);
    }
  };

  // "Já me inscrevi — verificar": relê endpoint + inscritos e dá um retorno claro.
  const checkReceipts = async () => {
    if (!token) return;
    setChecking(true);
    try {
      const list = await refreshIngestEndpoints();
      await refreshAttendees();
      const count = list?.find((e) => e.token === token)?.received_count ?? liveCount;
      if (count > 0) toast(`${count} inscrito(s) recebido(s) da sua página`);
      else toast("Ainda não chegou nenhuma inscrição — faça um envio no formulário publicado");
    } finally {
      setChecking(false);
    }
  };

  // Passo de backlog: importar quem já se inscreveu (CSV exportado do HubSpot).
  if (csvOpen) {
    return (
      <HubspotCsvImportModal eventId={eventId} eventName={eventName} onClose={() => setCsvOpen(false)} />
    );
  }

  // Card de conclusão: o estado muda conforme a automação avança.
  const status = live
    ? {
        tone: "#00B863",
        icon: "check",
        title: "Está funcionando! 🎉",
        body: (
          <>
            Sua página já enviou <b>{liveCount}</b> inscrito{liveCount === 1 ? "" : "s"} para{" "}
            <b>{eventName}</b>. A automação está puxando sozinha — não precisa fazer mais nada.
            {endpoint?.last_received_at && (
              <> Último em {fmtDate(endpoint.last_received_at.slice(0, 10))}.</>
            )}
          </>
        ),
      }
    : testResult?.ok
      ? {
          tone: "#0EA5E9",
          icon: "bolt",
          title: "Conexão testada — tudo certo no Nexo",
          body: (
            <>
              O Nexo está pronto para receber. Falta o último passo: faça <b>uma inscrição de teste</b>{" "}
              no formulário da sua página publicada e clique em <b>“Já me inscrevi”</b> aqui embaixo.
            </>
          ),
        }
      : {
          tone: "#8A8A85",
          icon: "link",
          title: "Quase lá — falta ligar a sua página",
          body: (
            <>
              Copie o código abaixo, cole no HTML da sua landing page e publique. Depois é só clicar
              em <b>Testar conexão</b>.
            </>
          ),
        };

  return (
    <Modal
      title="Receber inscritos automaticamente"
      onClose={onClose}
      width={620}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      {!endpoint ? (
        <>
          <p style={{ fontSize: 13.5, color: "var(--dim)", marginTop: 0, marginBottom: 18, lineHeight: 1.6 }}>
            Ligue o formulário da sua landing page a este evento. A cada inscrição, a pessoa entra
            sozinha em <b>{eventName}</b> — sem você precisar exportar nem digitar nada.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              createHubspotIngest(eventId);
              toast("Pronto! Agora copie o código e cole na sua página");
            }}
          >
            <Icon name="bolt" size={15} /> Ativar recebimento automático
          </button>
          <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 12, marginBottom: 0 }}>
            Você vai receber um <b>código</b> para colar na sua página. É só copiar e colar — sem programar.
          </p>
        </>
      ) : (
        <>
          {/* ---- Card de conclusão / status ---- */}
          <div style={{ ...tint(status.tone), display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
            <span
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: 999,
                background: status.tone,
                color: "#fff",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon name={status.icon} size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{status.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6 }}>{status.body}</div>
              {!live && (
                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn btn-dark" onClick={testConnection} disabled={testing}>
                    <Icon name="bolt" size={15} /> {testing ? "Testando…" : "Testar conexão"}
                  </button>
                  <button className="btn" onClick={checkReceipts} disabled={checking}>
                    <Icon name="refresh" size={15} /> {checking ? "Verificando…" : "Já me inscrevi"}
                  </button>
                </div>
              )}
              {testResult && !live && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    color: testResult.ok ? "var(--green-deep)" : "var(--red)",
                    display: "flex",
                    gap: 6,
                    alignItems: "flex-start",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ flexShrink: 0, display: "inline-flex", marginTop: 1 }}>
                    <Icon name={testResult.ok ? "check" : "x"} size={15} />
                  </span>
                  <span>{testResult.msg}</span>
                </div>
              )}
            </div>
          </div>

          {/* ---- Passo 1: copiar o código ---- */}
          <Field label="1. Copie este código">
            <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "0 0 8px" }}>
              Ele já vem configurado para <b>{eventName}</b> — você não precisa editar nada.
            </p>
            <textarea
              className="input"
              readOnly
              rows={7}
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
          <button className="btn btn-dark" onClick={() => copy(snippet, "Código")}>
            <Icon name="download" size={15} /> Copiar código
          </button>

          {/* ---- Passo 2: colar na LP ---- */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>2. Cole na sua landing page e publique</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--dim)", lineHeight: 1.8 }}>
              <li>Abra o <b>HTML da landing page</b> — a mesma página onde está o formulário do HubSpot.</li>
              <li>Cole o código logo <b>antes do <code>&lt;/body&gt;</code></b> (ou no campo de HTML/footer da página).</li>
              <li><b>Publique</b> a página. Pronto — não precisa mexer no formulário do HubSpot.</li>
            </ol>
          </div>

          {/* ---- Aviso: um código por evento ---- */}
          <div style={{ ...tint("#B45309"), marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="bolt" size={15} /> Um código diferente para cada evento
            </div>
            <p style={{ fontSize: 12.5, color: "var(--dim)", margin: 0, lineHeight: 1.6 }}>
              Este código é exclusivo de <b>{eventName}</b>. Para receber inscritos de <b>outro evento</b>{" "}
              (outra página), abra esse outro evento aqui no Nexo e ative o recebimento lá para gerar um{" "}
              <b>novo código</b>. Não reutilize este mesmo código em outra página — as inscrições cairiam
              todas neste evento.
            </p>
          </div>

          {/* ---- Detalhes técnicos (escondidos por padrão) ---- */}
          <button
            className="btn btn-ghost"
            style={{ marginTop: 16 }}
            onClick={() => setAdvanced((a) => !a)}
          >
            <Icon name={advanced ? "chevUp" : "chevDown"} size={15} /> Detalhes técnicos (opcional)
          </button>
          {advanced && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "0 0 12px", lineHeight: 1.6 }}>
                Você normalmente <b>não precisa</b> mexer aqui — o endereço e o token abaixo já estão
                embutidos no código que você copiou. Ficam só para casos avançados (testes manuais ou suporte).
              </p>
              <Field label="Endereço do Nexo que recebe os envios (URL)">
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
                  <button className="btn" style={{ flexShrink: 0 }} onClick={() => copy(url, "Endereço")}>
                    Copiar
                  </button>
                </div>
              </Field>
              <Field label="Token (senha secreta que identifica este evento)">
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" readOnly value={token} onFocus={(e) => e.target.select()} />
                  <button className="btn" style={{ flexShrink: 0 }} onClick={() => copy(token, "Token")}>
                    Copiar
                  </button>
                </div>
              </Field>
              <button
                className="btn"
                style={{ color: "var(--red)", borderColor: "var(--red)" }}
                onClick={() => {
                  removeHubspotIngest(token);
                  setTestResult(null);
                  toast("Recebimento desativado");
                }}
              >
                <Icon name="trash" size={15} /> Desativar recebimento automático
              </button>
            </div>
          )}
        </>
      )}

      {/* ---- Backlog: importar quem já se inscreveu (CSV) ---- */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Já tem inscritos no HubSpot?</div>
        <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "0 0 10px", lineHeight: 1.6 }}>
          O recebimento automático só pega <b>novos</b> envios, daqui pra frente. Para trazer quem{" "}
          <b>já se inscreveu</b>, exporte o CSV no HubSpot e importe aqui (sem duplicar e-mails).
        </p>
        <button className="btn" onClick={() => setCsvOpen(true)}>
          <Icon name="upload" size={15} /> Importar inscritos atuais (CSV)
        </button>
      </div>
    </Modal>
  );
}
