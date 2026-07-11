"use client";

/* Notas fiscais — a central de comprovantes do evento: quais despesas já têm
   NF anexada, quais estão descobertas (pagas sem nota = risco de auditoria) e
   os arquivos prontos para baixar. Rastreabilidade é requisito do gestor. */
import { useRef, useState } from "react";
import { Badge, Card, Empty, Icon, Kpi, Menu, PageHead, useToast } from "@/components/app/kit";
import { TxFormModal, readDocFile } from "@/components/app/views/financeiro";
import {
  PAYMENT_META,
  categoryById,
  selectedEvent,
  setTransactionFile,
  txOf,
  useDb,
} from "@/lib/db";
import { downloadCsv, toCsv } from "@/lib/csv";
import { downloadDataUrl } from "@/lib/files";
import { fmtDateShort, fmtMoney, fmtMoneyFull } from "@/lib/format";
import type { Transaction } from "@/types";

const SEGMENTS: [string, string][] = [
  ["todas", "Todas"],
  ["com", "Com NF"],
  ["sem", "Sem NF"],
  ["boletos", "Boletos"],
];

const hasNf = (t: Transaction) => !!t.invoice_file || !!t.invoice_ref;

export function FinanceiroNotas() {
  const db = useDb();
  const toast = useToast();
  const [seg, setSeg] = useState("todas");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const pendingAttach = useRef<{ id: string; field: "invoice_file" | "boleto_file" } | null>(null);

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Notas fiscais" sub="Nenhum evento criado ainda" />
        <Empty icon="note" title="Crie um evento primeiro" sub="As NFs pertencem aos lançamentos de um evento." />
      </div>
    );
  }

  const outs = txOf(db, ev.id)
    .filter((t) => t.kind === "saida")
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const covered = outs.filter(hasNf);
  const uncovered = outs.filter((t) => !hasNf(t));
  const uncoveredPaid = uncovered.filter((t) => t.payment_status === "pago");
  const coveredSum = covered.reduce((s, t) => s + t.amount, 0);
  const uncoveredSum = uncovered.reduce((s, t) => s + t.amount, 0);
  const coveragePct = outs.length ? Math.round((covered.length / outs.length) * 100) : 0;

  const list = outs.filter((t) => {
    if (seg === "com") return hasNf(t);
    if (seg === "sem") return !hasNf(t);
    if (seg === "boletos") return !!t.boleto_file;
    return true;
  });

  const pickAttach = (id: string, field: "invoice_file" | "boleto_file") => {
    pendingAttach.current = { id, field };
    attachRef.current?.click();
  };

  const onAttachPicked = async (file: File) => {
    const p = pendingAttach.current;
    pendingAttach.current = null;
    if (!p) return;
    try {
      setTransactionFile(p.id, p.field, await readDocFile(file));
      toast(p.field === "invoice_file" ? "NF anexada" : "Boleto anexado");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não consegui ler esse arquivo");
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      ["Data", "Descrição", "Categoria", "Valor", "Pagamento", "NF (ref)", "Arquivo NF", "Boleto"],
      outs.map((t) => [
        t.occurred_on,
        t.description,
        categoryById(db, t.category_id)?.name ?? "",
        t.amount.toFixed(2).replace(".", ","),
        PAYMENT_META[t.payment_status]?.label ?? t.payment_status,
        t.invoice_ref ?? "",
        t.invoice_file ? "sim" : "não",
        t.boleto_file ? "sim" : "não",
      ])
    );
    downloadCsv(`nexo-notas-${ev.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Relação de NFs exportada (CSV)");
  };

  return (
    <div className="view">
      <input
        ref={attachRef}
        type="file"
        accept="application/pdf,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onAttachPicked(f);
        }}
      />
      <PageHead
        title="Notas fiscais"
        sub={`${ev.name} · cada despesa com o comprovante do lado — auditoria sem caça ao PDF`}
        actions={
          <button className="btn" onClick={exportCsv} disabled={outs.length === 0}>
            <Icon name="download" size={15} />Relação (CSV)
          </button>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi
          icon="note"
          iconTone="green"
          value={`${coveragePct}%`}
          label="Despesas com NF"
          foot={{
            text: `${covered.length} de ${outs.length} lançamento${outs.length === 1 ? "" : "s"}`,
            tone: coveragePct >= 80 ? "green" : "gray",
          }}
        />
        <Kpi icon="wallet" value={fmtMoney(coveredSum)} label="Valor coberto por NF" />
        <Kpi
          icon="clock"
          value={fmtMoney(uncoveredSum)}
          label="Descoberto (sem NF)"
          foot={
            uncoveredPaid.length > 0
              ? { text: `${uncoveredPaid.length} paga${uncoveredPaid.length === 1 ? "" : "s"} sem nota — cobre o fornecedor`, tone: "red" }
              : { text: "nada pago sem nota", tone: "green" }
          }
        />
        <Kpi
          icon="paperclip"
          value={outs.filter((t) => t.boleto_file).length}
          label="Boletos anexados"
        />
      </div>

      <Card pad0>
        <div className="nf-head">
          <div className="card-title">Despesas e comprovantes</div>
          <div className="seg">
            {SEGMENTS.map(([id, label]) => (
              <button key={id} className={seg === id ? "active" : ""} onClick={() => setSeg(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty
            icon="note"
            title={outs.length === 0 ? "Nenhuma despesa ainda" : "Nada neste recorte"}
            sub={
              outs.length === 0
                ? "Lance despesas no Financeiro — os comprovantes ficam organizados aqui."
                : "Troque o filtro acima."
            }
          />
        ) : (
          list.map((t) => {
            const cat = categoryById(db, t.category_id);
            const pay = PAYMENT_META[t.payment_status] ?? { tone: "gray", label: t.payment_status };
            const missing = !hasNf(t);
            return (
              <div className={"tx-row" + (missing && t.payment_status === "pago" ? " nf-risk" : "")} key={t.id}>
                <span className="tx-ic">{cat?.icon ?? "💳"}</span>
                <div>
                  <div className="ttl">{t.description}</div>
                  <div className="meta">
                    {[cat?.name, fmtDateShort(t.occurred_on), t.invoice_ref].filter(Boolean).join(" · ")}
                    {t.invoice_file && (
                      <a
                        className="tx-nf"
                        title={`Baixar NF — ${t.invoice_file.name}`}
                        onClick={() => downloadDataUrl(t.invoice_file!.name, t.invoice_file!.data)}
                      >
                        <Icon name="paperclip" size={12} />NF
                      </a>
                    )}
                    {t.boleto_file && (
                      <a
                        className="tx-nf"
                        title={`Baixar boleto — ${t.boleto_file.name}`}
                        onClick={() => downloadDataUrl(t.boleto_file!.name, t.boleto_file!.data)}
                      >
                        <Icon name="paperclip" size={12} />Boleto
                      </a>
                    )}
                  </div>
                </div>
                {missing ? <Badge tone={t.payment_status === "pago" ? "red" : "amber"}>sem NF</Badge> : <Badge tone="green">com NF</Badge>}
                <Badge tone={pay.tone}>{pay.label}</Badge>
                <span className="row" style={{ gap: 4 }}>
                  <span className="tx-amt out">- {fmtMoneyFull(t.amount)}</span>
                  <Menu
                    items={[
                      {
                        label: t.invoice_file ? "Trocar NF (arquivo)" : "Upar NF",
                        onClick: () => pickAttach(t.id, "invoice_file"),
                      },
                      {
                        label: t.boleto_file ? "Trocar boleto" : "Upar boleto",
                        onClick: () => pickAttach(t.id, "boleto_file"),
                      },
                      { label: "Editar lançamento (nº da NF…)", onClick: () => setEditing(t) },
                    ]}
                  />
                </span>
              </div>
            );
          })
        )}
      </Card>

      {editing && <TxFormModal eventId={ev.id} tx={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
