"use client";

/* Repasses & saques — o fluxo de caixa pendente do evento: o que ainda vai
   entrar (repasse do ticketing, patrocínio a receber) e o que ainda vai sair.
   Baixa em um clique quando o dinheiro cai — o status vem do próprio Financeiro. */
import { Badge, Card, Empty, Icon, Kpi, PageHead, useToast } from "@/components/app/kit";
import {
  categoryById,
  selectedEvent,
  txOf,
  updateTransaction,
  useDb,
} from "@/lib/db";
import { fmtDateShort, fmtMoney, fmtMoneyFull } from "@/lib/format";
import type { Transaction } from "@/types";

const agingDays = (t: Transaction) =>
  Math.max(0, Math.floor((Date.now() - new Date(t.occurred_on + "T00:00:00").getTime()) / 86400000));

function PendingList({ list, dir, emptyTitle, emptySub, settleLabel, onSettle, db }: {
  list: Transaction[];
  dir: "in" | "out";
  emptyTitle: string;
  emptySub: string;
  settleLabel: string;
  onSettle: (t: Transaction) => void;
  db: ReturnType<typeof useDb>;
}) {
  if (list.length === 0) {
    return <Empty icon="wallet" title={emptyTitle} sub={emptySub} />;
  }
  return (
    <div className="rep-list">
      {list.map((t) => {
        const cat = categoryById(db, t.category_id);
        const days = agingDays(t);
        return (
          <div className="rep-row" key={t.id}>
            <span className="tx-ic">{cat?.icon ?? (dir === "in" ? "💰" : "💳")}</span>
            <span className="rep-main">
              <span className="rep-nm">{t.description}</span>
              <span className="rep-sub">
                {[cat?.name, fmtDateShort(t.occurred_on)].filter(Boolean).join(" · ")}
                {days > 0 && (
                  <span className={"rep-age" + (days >= 30 ? " late" : "")}>
                    {" "}· aguardando há {days} dia{days === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </span>
            <span className={"tx-amt " + dir}>
              {dir === "in" ? "+ " : "- "}{fmtMoneyFull(t.amount)}
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => onSettle(t)}>
              <Icon name="check" size={14} />{settleLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FinanceiroRepasses() {
  const db = useDb();
  const toast = useToast();

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Repasses & saques" sub="Nenhum evento criado ainda" />
        <Empty icon="download" title="Crie um evento primeiro" sub="O fluxo pendente pertence a um evento." />
      </div>
    );
  }

  const txs = txOf(db, ev.id);
  const toReceive = txs
    .filter((t) => t.kind === "entrada" && t.payment_status === "pendente")
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const toPay = txs
    .filter((t) => t.kind === "saida" && t.payment_status === "pendente")
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const received = txs.filter((t) => t.kind === "entrada" && t.payment_status !== "pendente");
  const paid = txs.filter((t) => t.kind === "saida" && t.payment_status !== "pendente");

  const toReceiveSum = toReceive.reduce((s, t) => s + t.amount, 0);
  const toPaySum = toPay.reduce((s, t) => s + t.amount, 0);
  const receivedSum = received.reduce((s, t) => s + t.amount, 0);
  const netPending = toReceiveSum - toPaySum;

  const settle = (t: Transaction, status: "recebido" | "pago") => {
    updateTransaction(t.id, { payment_status: status });
    toast(status === "recebido" ? `Recebido: ${t.description}` : `Pago: ${t.description}`);
  };

  return (
    <div className="view">
      <PageHead
        title="Repasses & saques"
        sub={`${ev.name} · repasse do ticketing, patrocínio e contas a pagar — dê baixa quando cair`}
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi
          icon="download"
          iconTone="green"
          value={fmtMoney(toReceiveSum)}
          label="A receber"
          delta={`${toReceive.length} pendente${toReceive.length === 1 ? "" : "s"}`}
          deltaDir="flat"
        />
        <Kpi
          icon="upload"
          value={fmtMoney(toPaySum)}
          label="A pagar"
          delta={`${toPay.length} pendente${toPay.length === 1 ? "" : "s"}`}
          deltaDir="flat"
        />
        <Kpi
          icon="trending"
          value={fmtMoney(netPending)}
          label="Saldo pendente (entra − sai)"
          foot={{
            text: netPending >= 0 ? "fluxo pendente positivo" : "vai sair mais do que entrar",
            tone: netPending >= 0 ? "green" : "red",
          }}
        />
        <Kpi
          icon="check"
          iconTone="green"
          value={fmtMoney(receivedSum)}
          label="Já recebido"
          delta={`${received.length} lançamento${received.length === 1 ? "" : "s"}`}
          deltaDir={received.length > 0 ? "up" : "flat"}
        />
      </div>

      <div className="grid-2">
        <Card
          title="A receber"
          actions={toReceive.length > 0 ? <Badge tone="green">{fmtMoney(toReceiveSum)}</Badge> : undefined}
        >
          <PendingList
            list={toReceive}
            dir="in"
            emptyTitle="Nada a receber"
            emptySub="Lance receitas com pagamento pendente (repasse do Sympla, patrocínio) e acompanhe aqui."
            settleLabel="Recebi"
            onSettle={(t) => settle(t, "recebido")}
            db={db}
          />
        </Card>
        <Card
          title="A pagar"
          actions={toPay.length > 0 ? <Badge tone="amber">{fmtMoney(toPaySum)}</Badge> : undefined}
        >
          <PendingList
            list={toPay}
            dir="out"
            emptyTitle="Nada a pagar"
            emptySub="Despesas pendentes de pagamento aparecem aqui para dar baixa."
            settleLabel="Paguei"
            onSettle={(t) => settle(t, "pago")}
            db={db}
          />
        </Card>
      </div>

      <Card title="Liquidados" style={{ marginTop: 16 }} pad0>
        {received.length + paid.length === 0 ? (
          <Empty icon="check" title="Nada liquidado ainda" sub="O histórico de baixas aparece aqui." />
        ) : (
          [...received, ...paid]
            .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
            .slice(0, 12)
            .map((t) => {
              const cat = categoryById(db, t.category_id);
              const dir = t.kind === "entrada" ? "in" : "out";
              return (
                <div className="tx-row" key={t.id}>
                  <span className="tx-ic">{cat?.icon ?? "💳"}</span>
                  <div>
                    <div className="ttl">{t.description}</div>
                    <div className="meta">{[cat?.name, fmtDateShort(t.occurred_on)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Badge tone="green">{t.kind === "entrada" ? "Recebido" : "Pago"}</Badge>
                  <span className={"tx-amt " + dir}>
                    {dir === "in" ? "+ " : "- "}{fmtMoneyFull(t.amount)}
                  </span>
                </div>
              );
            })
        )}
      </Card>
    </div>
  );
}
