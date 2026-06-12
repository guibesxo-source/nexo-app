"use client";

/* Dashboard do evento — FR-B3/F1: KPIs, gráfico de inscritos, atividade. */
import { useState } from "react";
import { BarChart, Card, Donut, Empty, Icon, Kpi, PageHead, useToast } from "@/components/app/kit";
import { ImportAttendeesModal } from "@/components/app/import-attendees";
import { SymplaImportModal } from "@/components/app/sympla-import";
import { useGo, useUi } from "@/components/app/shell";
import {
  eventById,
  eventKpis,
  selectedEvent,
  useDb,
  weeklySignups,
} from "@/lib/db";
import { downloadCsv, toCsv } from "@/lib/csv";
import { daysUntil, fmtMoney, relTime } from "@/lib/format";

export function Dashboard({ eventId }: { eventId?: string }) {
  const db = useDb();
  const go = useGo();
  const toast = useToast();
  const { openNewEvent } = useUi();
  const [importing, setImporting] = useState(false);
  const [symplaOpen, setSymplaOpen] = useState(false);

  const ev = eventId ? eventById(db, eventId) : selectedEvent(db);

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Visão geral" sub="Nenhum evento criado ainda" />
        <Empty
          icon="calendar"
          title="Crie seu primeiro evento"
          sub="O dashboard mostra inscritos, orçamento e checklist do evento ativo."
          action={
            <button className="btn btn-primary" onClick={openNewEvent}>
              <Icon name="plus" size={15} />Novo evento
            </button>
          }
        />
      </div>
    );
  }

  const k = eventKpis(db, ev.id);
  const weeks = weeklySignups(db, ev.id);
  const thisWeek = weeks[weeks.length - 1]?.v ?? 0;
  const days = daysUntil(ev.starts_at);
  const checklistPct = k.tasksTotal ? Math.round((k.tasksDone / k.tasksTotal) * 100) : 0;
  const capacityPct = ev.capacity ? Math.min(100, Math.round((k.total / ev.capacity) * 100)) : 0;

  const exportSummary = () => {
    const csv = toCsv(
      ["Indicador", "Valor"],
      [
        ["Evento", ev.name],
        ["Inscritos", k.total],
        ["Confirmados", k.confirmed],
        ["Check-ins", k.checkin],
        ["Taxa de confirmação (%)", k.confirmRate],
        ["Orçamento previsto", ev.budget_planned],
        ["Gasto", k.spent],
        ["Receitas", k.income],
        ["Saldo disponível", k.available],
        ["Tarefas concluídas", `${k.tasksDone}/${k.tasksTotal}`],
        ["Tarefas atrasadas", k.tasksLate],
        ["Custo por inscrito", k.costPerAttendee],
      ]
    );
    downloadCsv(`nexo-resumo-${ev.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Resumo exportado (CSV)");
  };

  const progress = [
    { nm: "Captação de inscritos", v: capacityPct },
    { nm: "Orçamento executado", v: Math.min(100, k.budgetPct) },
    { nm: "Checklist de produção", v: checklistPct },
    { nm: "Taxa de confirmação", v: k.confirmRate },
  ];

  return (
    <div className="view">
      <PageHead
        eyebrow={ev.name}
        title="Visão geral"
        sub={`Atualizado agora · ${db.members.length} membros na organização`}
        actions={
          <>
            <button className="btn" onClick={() => setImporting(true)}>
              <Icon name="upload" size={15} />Importar lista
            </button>
            <button className="btn" onClick={() => setSymplaOpen(true)}>
              <Icon name="link" size={15} />Sympla
            </button>
            <button className="btn" onClick={exportSummary}>
              <Icon name="download" size={15} />Exportar
            </button>
            <button className="btn btn-primary" onClick={openNewEvent}>
              <Icon name="plus" size={15} />Novo evento
            </button>
          </>
        }
      />

      {importing && <ImportAttendeesModal eventId={ev.id} onClose={() => setImporting(false)} />}
      {symplaOpen && (
        <SymplaImportModal eventId={ev.id} eventName={ev.name} onClose={() => setSymplaOpen(false)} />
      )}

      <div className="kpi-grid">
        <Kpi
          icon="users" iconTone="green"
          value={String(k.total)}
          label="Inscritos totais"
          delta={thisWeek > 0 ? `+${thisWeek} esta semana` : "sem novos"}
          deltaDir={thisWeek > 0 ? "up" : "flat"}
        />
        <Kpi
          icon="check"
          value={String(k.confirmed)}
          label={`Confirmados · ${k.confirmRate}%`}
          delta={`${k.pending} pendentes`}
          deltaDir={k.pending > 0 ? "flat" : "up"}
        />
        <Kpi
          icon="wallet"
          value={`${k.budgetPct}%`}
          label="Orçamento usado"
          delta={k.budgetPct <= 100 ? "no plano" : "estourado"}
          deltaDir={k.budgetPct <= 100 ? "flat" : "down"}
        />
        <Kpi
          icon="checkSquare"
          value={`${k.tasksDone}/${k.tasksTotal}`}
          label="Tarefas concluídas"
          delta={k.tasksLate > 0 ? `${k.tasksLate} atrasadas` : "em dia"}
          deltaDir={k.tasksLate > 0 ? "down" : "up"}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title="Inscritos por semana" link="Ver inscritos" onLink={() => go("inscritos")}>
          <BarChart data={weeks} lastAlt />
          <div style={{ display: "flex", gap: 18, marginTop: 16, fontSize: 12.5, color: "var(--dim)" }}>
            <span className="row" style={{ gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--green)", display: "inline-block" }} />
              Novas inscrições
            </span>
            <span className="row" style={{ gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#E2E2DE", display: "inline-block" }} />
              Semana atual (parcial)
            </span>
          </div>
        </Card>

        <Card title="Confirmação">
          <Donut
            pct={k.confirmRate}
            label="conf."
            legend={[
              { color: "var(--green)", label: "Confirmados", value: String(k.confirmed) },
              { color: "#E8E8E5", label: "Pendentes", value: String(k.pending) },
            ]}
          />
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-2)", fontSize: 12.5, color: "var(--dim)" }}>
            Custo por inscrito:{" "}
            <b style={{ color: "var(--text)" }}>
              {k.total > 0 ? fmtMoney(k.costPerAttendee) : "—"}
            </b>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Atividade recente">
          {db.activity.length === 0 ? (
            <Empty icon="bolt" title="Sem atividade ainda" sub="As ações da equipe aparecem aqui." />
          ) : (
            <div className="activity">
              {db.activity.slice(0, 5).map((a) => (
                <div className="act-row" key={a.id}>
                  <span className="act-ic">{a.icon}</span>
                  <div className="act-body">
                    <div className="act-txt">
                      {a.text.map((s, j) => (j % 2 ? <b key={j}>{s}</b> : s))}
                    </div>
                    <div className="act-time">{relTime(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Progresso por área">
          <div className="progress-list">
            {progress.map((p, i) => (
              <div className="prog-item" key={i}>
                <div className="prog-top">
                  <span className="nm">{p.nm}</span>
                  <span className="vl">{p.v}%</span>
                </div>
                <div className="prog-bar"><i style={{ width: p.v + "%" }} /></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--dim)" }}>
                {days >= 0 ? "Dias para o evento" : "Evento realizado"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {days >= 0 ? `${days} dia${days === 1 ? "" : "s"}` : `há ${Math.abs(days)} dias`}
              </div>
            </div>
            <button className="btn btn-dark btn-sm" onClick={() => go("checklist")}>
              Ver checklist
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
