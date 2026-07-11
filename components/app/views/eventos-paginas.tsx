"use client";

/* Páginas de inscrição — central de captação por evento: de onde os inscritos
   entram (webhook HubSpot, Sympla, planilha, manual), com status vivo de cada
   canal. O Nexo não vende ingresso; ele recebe e consolida as inscrições. */
import { useState } from "react";
import { Badge, Card, Empty, Icon, Kpi, PageHead, useToast } from "@/components/app/kit";
import { HubspotWebhookModal } from "@/components/app/hubspot-webhook";
import {
  ORIGIN_META,
  originBreakdown,
  originOf,
  useDb,
} from "@/lib/db";
import { useGo } from "@/components/app/shell";
import { fmtDateShort, relTime } from "@/lib/format";
import type { Event } from "@/types";

export function EventosPaginas() {
  const db = useDb();
  const go = useGo();
  const toast = useToast();
  const [webhookFor, setWebhookFor] = useState<Event | null>(null);

  const events = db.events.filter((e) => e.status !== "cancelado");
  const endpoints = db.ingestEndpoints;
  const links = db.settings.sympla_event_links ?? {};

  const totalReceived = endpoints.reduce((sum, e) => sum + e.received_count, 0);
  const linkedSympla = events.filter((e) => links[e.id]).length;
  const last = endpoints
    .map((e) => e.last_received_at)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);

  if (events.length === 0) {
    return (
      <div className="view">
        <PageHead title="Páginas de inscrição" sub="Canais de captação por evento" />
        <Empty
          icon="link"
          title="Crie um evento primeiro"
          sub="Cada evento ganha seus canais de captação: webhook para a LP, Sympla e importação."
          action={
            <button className="btn btn-primary" onClick={() => go("eventos")}>
              Ir para Eventos
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="view">
      <PageHead
        title="Páginas de inscrição"
        sub="De onde os inscritos entram — conecte a LP, o Sympla ou importe listas"
        actions={
          <button className="btn" onClick={() => go("integracoes")}>
            <Icon name="link" size={15} />
            Integrações
          </button>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <Kpi
          icon="bolt"
          iconTone="green"
          value={totalReceived}
          label="Inscrições recebidas via webhook"
          foot={last ? { text: `última ${relTime(last)}`, tone: "green" } : undefined}
        />
        <Kpi icon="link" value={endpoints.length} label="Webhooks ativos (LP → Nexo)" />
        <Kpi icon="refresh" value={linkedSympla} label="Eventos sincronizando com o Sympla" />
      </div>

      <div className="chan-grid">
        {events.map((ev) => {
          const evEndpoints = endpoints.filter((e) => e.event_id === ev.id);
          const sympla = links[ev.id];
          const origins = originBreakdown(db, ev.id);
          const total = origins.reduce((sum, o) => sum + o.count, 0);
          const manualCount = db.attendees.filter(
            (a) => a.event_id === ev.id && a.status !== "cancelado" && originOf(a) === "manual"
          ).length;

          return (
            <Card key={ev.id} pad0>
              <div className="chan-head">
                <span className="chan-cover" style={{ backgroundImage: ev.cover }} />
                <span className="chan-title">
                  <span className="chan-nm">{ev.name}</span>
                  <span className="chan-sub">
                    {fmtDateShort(ev.starts_at)} · {total} inscrito{total === 1 ? "" : "s"}
                  </span>
                </span>
                <button className="btn btn-sm" onClick={() => go("inscritos")}>
                  Ver inscritos
                </button>
              </div>

              <div className="chan-rows">
                {/* Webhook (LP com formulário HubSpot, sem API) */}
                <div className="chan-row">
                  <span className="chan-ic amber"><Icon name="bolt" size={16} /></span>
                  <span className="chan-main">
                    <span className="chan-k">Formulário da LP (webhook)</span>
                    <span className="chan-v">
                      {evEndpoints.length === 0
                        ? "Não conectado — receba inscrições da sua landing page"
                        : evEndpoints
                            .map(
                              (e) =>
                                `${e.received_count} recebida${e.received_count === 1 ? "" : "s"}` +
                                (e.last_received_at ? ` · última ${relTime(e.last_received_at)}` : "")
                            )
                            .join(" · ")}
                    </span>
                  </span>
                  {evEndpoints.length > 0 && <Badge tone="green" dot>ativo</Badge>}
                  <button className="btn btn-sm" onClick={() => setWebhookFor(ev)}>
                    {evEndpoints.length === 0 ? "Conectar" : "Gerenciar"}
                  </button>
                </div>

                {/* Sympla */}
                <div className="chan-row">
                  <span className="chan-ic blue"><Icon name="refresh" size={16} /></span>
                  <span className="chan-main">
                    <span className="chan-k">Sympla</span>
                    <span className="chan-v">
                      {sympla
                        ? `${sympla.sympla_event_name ?? "Evento vinculado"} · ${
                            sympla.last_sync_at ? `sync ${relTime(sympla.last_sync_at)}` : "aguardando 1º sync"
                          }`
                        : "Não vinculado — sincronize os ingressos automaticamente"}
                    </span>
                  </span>
                  {sympla && <Badge tone="blue" dot>sync a cada 60s</Badge>}
                  <button className="btn btn-sm" onClick={() => go("integracoes")}>
                    {sympla ? "Ver integração" : "Vincular"}
                  </button>
                </div>

                {/* Importação manual */}
                <div className="chan-row">
                  <span className="chan-ic gray"><Icon name="upload" size={16} /></span>
                  <span className="chan-main">
                    <span className="chan-k">Planilha / manual</span>
                    <span className="chan-v">
                      {manualCount + (origins.find((o) => o.origin === "csv")?.count ?? 0) > 0
                        ? `${origins.find((o) => o.origin === "csv")?.count ?? 0} por planilha · ${manualCount} manuais`
                        : "Importe CSV/planilha ou cadastre direto na lista"}
                    </span>
                  </span>
                  <button className="btn btn-sm" onClick={() => go("inscritos")}>
                    Importar
                  </button>
                </div>
              </div>

              {origins.length > 0 && (
                <div className="chan-foot">
                  <span className="chan-foot-lbl">Por origem:</span>
                  {origins.map((o) => (
                    <span className="chan-origin" key={o.origin}>
                      <Badge tone={ORIGIN_META[o.origin].tone}>{ORIGIN_META[o.origin].label}</Badge>
                      <b>{o.count}</b>
                      <span className="chan-origin-pct">
                        {total ? Math.round((o.count / total) * 100) : 0}%
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {webhookFor && (
        <HubspotWebhookModal
          eventId={webhookFor.id}
          eventName={webhookFor.name}
          onClose={() => {
            setWebhookFor(null);
            toast("Canal atualizado");
          }}
        />
      )}
    </div>
  );
}
