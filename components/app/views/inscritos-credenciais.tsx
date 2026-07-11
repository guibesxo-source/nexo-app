"use client";

/* Credenciais & crachás — gera crachás imprimíveis a partir dos inscritos
   reais: escolha o público, o que aparece no crachá e imprima (A4, 8 por
   folha) ou exporte o CSV para a gráfica. Zero retrabalho de planilha. */
import { useEffect, useState } from "react";
import { Card, Empty, Icon, Kpi, PageHead, Toggle, useToast } from "@/components/app/kit";
import {
  ATTENDEE_STATUS_META,
  attendeesOf,
  selectedEvent,
  useDb,
} from "@/lib/db";
import { downloadCsv, toCsv } from "@/lib/csv";
import { fmtDateShort } from "@/lib/format";
import type { Attendee } from "@/types";

type Audience = "ativos" | "confirmados" | "checkin";

const AUDIENCES: [Audience, string][] = [
  ["ativos", "Todos os ativos"],
  ["confirmados", "Confirmados"],
  ["checkin", "Com check-in"],
];

function matches(a: Attendee, audience: Audience): boolean {
  if (a.status === "cancelado") return false;
  if (audience === "confirmados") return a.status === "confirmado" || a.status === "checkin";
  if (audience === "checkin") return a.status === "checkin";
  return true;
}

const credCode = (a: Attendee) => a.id.replace(/-/g, "").slice(0, 6).toUpperCase();

export function InscritosCredenciais() {
  const db = useDb();
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>("confirmados");
  const [q, setQ] = useState("");
  const [showCompany, setShowCompany] = useState(true);
  const [showTicket, setShowTicket] = useState(true);
  const [showCode, setShowCode] = useState(true);

  // Garantia extra: se o afterprint não disparar, a classe não pode ficar presa.
  useEffect(() => () => document.body.classList.remove("print-badges"), []);

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Credenciais & crachás" sub="Nenhum evento criado ainda" />
        <Empty icon="ticket" title="Crie um evento primeiro" sub="Os crachás nascem dos inscritos do evento." />
      </div>
    );
  }

  const all = attendeesOf(db, ev.id).filter((a) => a.status !== "cancelado");
  const qq = q.trim().toLowerCase();
  const list = all
    .filter((a) => matches(a, audience))
    .filter((a) => !qq || (a.name + " " + a.email + " " + a.company).toLowerCase().includes(qq))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const printBadges = () => {
    if (list.length === 0) return;
    document.body.classList.add("print-badges");
    const done = () => {
      document.body.classList.remove("print-badges");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
    setTimeout(done, 2000); // navegadores sem afterprint confiável
  };

  const exportCsv = () => {
    const csv = toCsv(
      ["Nome", "Empresa", "Ingresso", "Status", "Código"],
      list.map((a) => [
        a.name,
        a.company,
        a.ticket,
        ATTENDEE_STATUS_META[a.status].label,
        credCode(a),
      ])
    );
    downloadCsv(`nexo-credenciais-${ev.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Lista para a gráfica exportada (CSV)");
  };

  return (
    <div className="view">
      <PageHead
        title="Credenciais & crachás"
        sub={`${ev.name} · ${list.length} crachá${list.length === 1 ? "" : "s"} no lote atual`}
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={list.length === 0}>
              <Icon name="download" size={15} />CSV p/ gráfica
            </button>
            <button className="btn btn-primary" onClick={printBadges} disabled={list.length === 0}>
              <Icon name="note" size={15} />Imprimir ({list.length})
            </button>
          </>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <Kpi icon="users" value={all.length} label="Inscritos ativos" />
        <Kpi
          icon="check"
          iconTone="green"
          value={all.filter((a) => a.status === "confirmado" || a.status === "checkin").length}
          label="Confirmados (público típico do crachá)"
        />
        <Kpi icon="ticket" value={Math.ceil(list.length / 8) || 0} label="Folhas A4 (8 crachás por folha)" />
      </div>

      <Card>
        <div className="cred-controls">
          <div className="seg">
            {AUDIENCES.map(([id, label]) => (
              <button key={id} className={audience === id ? "active" : ""} onClick={() => setAudience(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="input-search cred-search">
            <Icon name="search" size={15} />
            <input placeholder="Filtrar por nome, e-mail, empresa…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="cred-toggles">
            <label className="cred-toggle"><Toggle on={showCompany} onChange={setShowCompany} />Empresa</label>
            <label className="cred-toggle"><Toggle on={showTicket} onChange={setShowTicket} />Ingresso</label>
            <label className="cred-toggle"><Toggle on={showCode} onChange={setShowCode} />Código</label>
          </div>
        </div>
      </Card>

      {list.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <Empty
            icon="ticket"
            title="Nenhum inscrito neste recorte"
            sub="Ajuste o público ou o filtro acima — os crachás são gerados dos inscritos reais."
          />
        </Card>
      ) : (
        <div className="badge-sheet">
          {list.map((a) => (
            <div className="cred-badge" key={a.id}>
              <span className={"cred-strip st-" + a.status} />
              <span className="cred-head">
                <span className="cred-mark" />
                <span className="cred-event">{ev.name}</span>
              </span>
              <span className="cred-name">{a.name}</span>
              {showCompany && a.company && <span className="cred-co">{a.company}</span>}
              <span className="cred-foot">
                {showTicket && <span className="cred-ticket">{a.ticket || "Geral"}</span>}
                <span className="cred-date">{fmtDateShort(ev.starts_at)}</span>
                {showCode && <span className="cred-code">#{credCode(a)}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="field-hint" style={{ marginTop: 14 }}>
        A faixa lateral do crachá segue o status ({ATTENDEE_STATUS_META.confirmado.label} = verde,{" "}
        {ATTENDEE_STATUS_META.pendente.label} = âmbar, {ATTENDEE_STATUS_META.checkin.label} = azul). Na
        impressão saem 8 por folha A4 — corte nas guias.
      </p>
    </div>
  );
}
