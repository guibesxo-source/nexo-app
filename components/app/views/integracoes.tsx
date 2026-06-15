"use client";

/* APIs & Integrações — hub de nível workspace para conectar/gerenciar as
   integrações do Nexo. HubSpot, Sympla e ClickUp são reais (validam via os
   proxies /api/*); o restante é roadmap, marcado como "Em breve".
   - HubSpot/Sympla puxam inscritos; ClickUp puxa tarefas pro checklist.
   - Conectar é nível workspace; importar mira o evento selecionado (ou, no
     Sympla, cria/linka eventos). */
import { useState } from "react";
import { Badge, Icon, PageHead } from "@/components/app/kit";
import { useGo } from "@/components/app/shell";
import {
  selectedEvent,
  setClickupToken,
  setHubspotToken,
  setSymplaToken,
  useDb,
} from "@/lib/db";
import {
  ConnectIntegrationModal,
  type IntegrationProvider,
} from "@/components/app/integration-connect";
import { SymplaEventsModal } from "@/components/app/sympla-events";
import { ClickupImportModal } from "@/components/app/clickup-import";
import { HubspotImportModal } from "@/components/app/hubspot-import";

/** Chama um proxy de integração (/api/hubspot|sympla|clickup) e devolve os itens. */
async function callProxy(path: string, body: Record<string, string>): Promise<unknown[]> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown[]; error?: string } | null;
  if (!res.ok || !json?.data) throw new Error(json?.error ?? "Falha ao conectar");
  return json.data;
}

function IntegrationCard({ p, onManage }: {
  p: IntegrationProvider;
  onManage: (p: IntegrationProvider) => void;
}) {
  const connected = p.status === "connected";
  const soon = p.status === "soon";
  return (
    <div className={"card integ-card" + (soon ? " soon" : "")}>
      <div className="integ-top">
        <span className="integ-logo" style={{ background: p.color }}>{p.mark}</span>
        {connected ? (
          <Badge tone="green" dot>Conectado</Badge>
        ) : soon ? (
          <Badge tone="gray">Em breve</Badge>
        ) : (
          <Badge tone="blue">Disponível</Badge>
        )}
      </div>
      <div className="integ-name">{p.name}</div>
      <div className="integ-cat">{p.category}</div>
      <div className="integ-desc">{p.description}</div>
      <div className="integ-foot">
        {soon ? (
          <button className="btn" disabled>Em breve</button>
        ) : connected ? (
          p.onImport ? (
            <>
              <button className="btn btn-dark" onClick={p.onImport}>
                <Icon name="download" size={15} />{p.importLabel ?? "Importar"}
              </button>
              <button
                className="btn btn-ghost integ-manage"
                onClick={() => onManage(p)}
                title="Gerenciar conexão"
                aria-label="Gerenciar conexão"
              >
                <Icon name="settings" size={16} />
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => onManage(p)}>
              <Icon name="link" size={15} />Gerenciar
            </button>
          )
        ) : (
          <button className="btn btn-dark" onClick={() => onManage(p)}>
            <Icon name="link" size={15} />Conectar
          </button>
        )}
      </div>
    </div>
  );
}

export function Integracoes() {
  const db = useDb();
  const go = useGo();
  const ev = selectedEvent(db);
  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null);
  const [symplaEventsOpen, setSymplaEventsOpen] = useState(false);
  const [clickupOpen, setClickupOpen] = useState(false);
  const [hubspotOpen, setHubspotOpen] = useState(false);

  const openClickup = ev ? () => setClickupOpen(true) : undefined;
  const openHubspot = ev ? () => setHubspotOpen(true) : undefined;

  const available: IntegrationProvider[] = [
    {
      id: "hubspot",
      name: "HubSpot",
      mark: "HS",
      color: "#F97316",
      category: "CRM & Formulários",
      description: "Importe inscritos a partir das submissões de formulários do HubSpot.",
      status: db.settings.hubspot_token ? "connected" : "available",
      tokenLabel: "Private App token do HubSpot",
      placeholder: "Cole o token (pat-na…)",
      minLen: 10,
      helpText: (
        <>
          Gere em HubSpot → Configurações → <b>Integrações → Private Apps</b>, com o escopo{" "}
          <b>forms</b>. Use o portal <b>pessoal</b> do Nexo — nunca o da Prolog.
        </>
      ),
      currentToken: db.settings.hubspot_token ?? null,
      validate: async (token) => ({
        count: (await callProxy("/api/hubspot", { resource: "forms", token })).length,
        noun: "formulário",
      }),
      save: setHubspotToken,
      onImport: openHubspot,
      importLabel: "Importar inscritos",
    },
    {
      id: "sympla",
      name: "Sympla",
      mark: "Sy",
      color: "#0EA5E9",
      category: "Ingressos & Inscrições",
      description: "Puxe os participantes dos seus eventos publicados no Sympla.",
      status: db.settings.sympla_token ? "connected" : "available",
      tokenLabel: "Token da API do Sympla",
      placeholder: "Cole o token do Sympla",
      minLen: 8,
      helpText: (
        <>
          Gere em Sympla → <b>Minha conta → Integrações</b> → API Sympla. O token fica salvo
          só neste navegador.
        </>
      ),
      currentToken: db.settings.sympla_token ?? null,
      validate: async (token) => ({
        count: (await callProxy("/api/sympla", { resource: "events", token })).length,
        noun: "evento",
      }),
      save: setSymplaToken,
      afterConnect: () => setSymplaEventsOpen(true),
      onImport: () => setSymplaEventsOpen(true),
      importLabel: "Importar eventos",
    },
    {
      id: "clickup",
      name: "ClickUp",
      mark: "CU",
      color: "#7B68EE",
      category: "Tarefas & Projetos",
      description: "Importe tarefas de uma lista do ClickUp para o checklist do evento.",
      status: db.settings.clickup_token ? "connected" : "available",
      tokenLabel: "Personal API Token do ClickUp",
      placeholder: "Cole o token (pk_…)",
      minLen: 10,
      helpText: (
        <>
          Gere em ClickUp → <b>Settings → Apps</b> → <b>API Token</b> (pk_…). As tarefas entram no
          checklist do evento selecionado.
        </>
      ),
      currentToken: db.settings.clickup_token ?? null,
      validate: async (token) => ({
        count: (await callProxy("/api/clickup", { resource: "teams", token })).length,
        noun: "workspace",
      }),
      save: setClickupToken,
      afterConnect: openClickup,
      onImport: openClickup,
      importLabel: "Importar tarefas",
    },
  ];

  const soon: IntegrationProvider[] = [
    {
      id: "eventbrite", name: "Eventbrite", mark: "Eb", color: "#F43F5E",
      category: "Ingressos & Inscrições",
      description: "Sincronize inscritos de eventos publicados no Eventbrite.",
      status: "soon",
    },
    {
      id: "stripe", name: "Stripe", mark: "St", color: "#6366F1",
      category: "Pagamentos",
      description: "Concilie pagamentos e receitas dos seus eventos no Financeiro.",
      status: "soon",
    },
    {
      id: "slack", name: "Slack", mark: "Sl", color: "#EC4899",
      category: "Notificações",
      description: "Receba avisos de novos inscritos e tarefas em um canal do time.",
      status: "soon",
    },
  ];

  const connectedCount = available.filter((p) => p.status === "connected").length;

  return (
    <div className="view">
      <PageHead
        title="APIs & Integrações"
        sub={
          connectedCount > 0
            ? `${connectedCount} de ${available.length} integrações conectadas · importe inscritos e tarefas e sincronize o workspace.`
            : "Conecte ferramentas externas para importar inscritos e tarefas e sincronizar o workspace."
        }
      />

      <div className="integ-section">Disponíveis agora</div>
      <div className="integ-grid">
        {available.map((p) => (
          <IntegrationCard key={p.id} p={p} onManage={setConnecting} />
        ))}
      </div>

      <div className="integ-section">Em breve</div>
      <div className="integ-grid">
        {soon.map((p) => (
          <IntegrationCard key={p.id} p={p} onManage={setConnecting} />
        ))}
      </div>

      <p className="integ-note" style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ display: "inline-flex" }}><Icon name="upload" size={15} /></span>
        Também dá para importar uma lista via <b>CSV</b> direto na tela de{" "}
        <a
          onClick={() => go("inscritos")}
          style={{ cursor: "pointer", color: "var(--green-deep)", fontWeight: 600 }}
        >
          Inscritos
        </a>
        .
      </p>

      {connecting && (
        <ConnectIntegrationModal provider={connecting} onClose={() => setConnecting(null)} />
      )}
      {symplaEventsOpen && <SymplaEventsModal onClose={() => setSymplaEventsOpen(false)} />}
      {clickupOpen && ev && (
        <ClickupImportModal eventId={ev.id} eventName={ev.name} onClose={() => setClickupOpen(false)} />
      )}
      {hubspotOpen && ev && (
        <HubspotImportModal eventId={ev.id} eventName={ev.name} onClose={() => setHubspotOpen(false)} />
      )}
    </div>
  );
}
