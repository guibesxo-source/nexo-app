"use client";

/* Transações — o livro-razão completo do evento: busca, filtros combinados
   (tipo, pagamento, categoria, período), total do recorte e exportação.
   A visão geral fica no Financeiro; aqui é onde se audita lançamento a lançamento. */
import { useState } from "react";
import { Badge, Card, Empty, Icon, Menu, PageHead, useToast } from "@/components/app/kit";
import { TxFormModal } from "@/components/app/views/financeiro";
import {
  PAYMENT_META,
  categoryById,
  removeTransaction,
  selectedEvent,
  txOf,
  useDb,
} from "@/lib/db";
import { downloadCsv, toCsv } from "@/lib/csv";
import { fmtDateShort, fmtMoney, fmtMoneyFull } from "@/lib/format";
import type { Transaction } from "@/types";

const KIND_SEGMENTS: [string, string][] = [
  ["todos", "Todos"],
  ["saida", "Despesas"],
  ["entrada", "Receitas"],
];

export function FinanceiroTransacoes() {
  const db = useDb();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("todos");
  const [pay, setPay] = useState("todos");
  const [cat, setCat] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Transações" sub="Nenhum evento criado ainda" />
        <Empty icon="wallet" title="Crie um evento primeiro" sub="As transações pertencem a um evento." />
      </div>
    );
  }

  const txs = txOf(db, ev.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const qq = q.trim().toLowerCase();
  const list = txs.filter((t) => {
    if (kind !== "todos" && t.kind !== kind) return false;
    if (pay !== "todos" && t.payment_status !== pay) return false;
    if (cat !== "todas" && (t.category_id ?? "none") !== cat) return false;
    if (from && t.occurred_on < from) return false;
    if (to && t.occurred_on > to) return false;
    if (qq) {
      const catName = categoryById(db, t.category_id)?.name ?? "";
      if (!(t.description + " " + catName + " " + (t.invoice_ref ?? "")).toLowerCase().includes(qq)) return false;
    }
    return true;
  });

  const inSum = list.filter((t) => t.kind === "entrada").reduce((s, t) => s + t.amount, 0);
  const outSum = list.filter((t) => t.kind === "saida").reduce((s, t) => s + t.amount, 0);
  const net = inSum - outSum;
  const filtered = list.length !== txs.length;

  const exportCsv = () => {
    const csv = toCsv(
      ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Pagamento", "NF"],
      list.map((t) => [
        t.occurred_on,
        t.description,
        categoryById(db, t.category_id)?.name ?? "",
        t.kind,
        (t.kind === "saida" ? -t.amount : t.amount).toFixed(2).replace(".", ","),
        PAYMENT_META[t.payment_status]?.label ?? t.payment_status,
        t.invoice_ref ?? "",
      ])
    );
    downloadCsv(`nexo-transacoes-${ev.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Transações exportadas (CSV)");
  };

  return (
    <div className="view">
      <PageHead
        title="Transações"
        sub={`${ev.name} · ${txs.length} lançamento${txs.length === 1 ? "" : "s"} no total`}
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={list.length === 0}>
              <Icon name="download" size={15} />CSV
            </button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} />Lançamento
            </button>
          </>
        }
      />

      <Card>
        <div className="txf-controls">
          <div className="input-search txf-search">
            <Icon name="search" size={15} />
            <input
              placeholder="Buscar por descrição, categoria, NF…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="seg">
            {KIND_SEGMENTS.map(([id, label]) => (
              <button key={id} className={kind === id ? "active" : ""} onClick={() => setKind(id)}>
                {label}
              </button>
            ))}
          </div>
          <select className="input txf-sel" value={pay} onChange={(e) => setPay(e.target.value)}>
            <option value="todos">Qualquer pagamento</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="recebido">Recebido</option>
          </select>
          <select className="input txf-sel" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="todas">Todas as categorias</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="none">Sem categoria</option>
          </select>
          <input className="input txf-date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="De" />
          <input className="input txf-date" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Até" />
        </div>

        <div className="txf-totals">
          <span>
            <b>{list.length}</b> lançamento{list.length === 1 ? "" : "s"}{filtered ? " no recorte" : ""}
          </span>
          <span className="txf-sum in">+ {fmtMoney(inSum)}</span>
          <span className="txf-sum out">− {fmtMoney(outSum)}</span>
          <span className={"txf-sum net" + (net < 0 ? " neg" : "")}>= {fmtMoney(net)}</span>
          {filtered && (
            <button
              className="btn btn-sm"
              onClick={() => { setQ(""); setKind("todos"); setPay("todos"); setCat("todas"); setFrom(""); setTo(""); }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </Card>

      <Card pad0 style={{ marginTop: 16 }}>
        {list.length === 0 ? (
          <Empty
            icon="wallet"
            title={txs.length === 0 ? "Nenhum lançamento ainda" : "Nada neste recorte"}
            sub={txs.length === 0 ? "Registre despesas e receitas para auditar aqui." : "Ajuste os filtros acima."}
            action={
              txs.length === 0 ? (
                <button className="btn btn-primary" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={15} />Primeiro lançamento
                </button>
              ) : undefined
            }
          />
        ) : (
          list.map((t) => {
            const catMeta = categoryById(db, t.category_id);
            const payMeta = PAYMENT_META[t.payment_status] ?? { tone: "gray", label: t.payment_status };
            const dir = t.kind === "entrada" ? "in" : "out";
            return (
              <div className="tx-row" key={t.id}>
                <span className="tx-ic">{catMeta?.icon ?? "💳"}</span>
                <div>
                  <div className="ttl">{t.description}</div>
                  <div className="meta">
                    {[catMeta?.name ?? "Sem categoria", t.invoice_ref, fmtDateShort(t.occurred_on)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <Badge tone={payMeta.tone}>{payMeta.label}</Badge>
                <span className="row" style={{ gap: 4 }}>
                  <span className={"tx-amt " + dir}>
                    {dir === "in" ? "+ " : "- "}{fmtMoneyFull(t.amount)}
                  </span>
                  <Menu
                    items={[
                      { label: "Editar lançamento", onClick: () => setEditing(t) },
                      {
                        label: "Excluir lançamento",
                        danger: true,
                        onClick: () => {
                          removeTransaction(t.id);
                          toast("Lançamento excluído");
                        },
                      },
                    ]}
                  />
                </span>
              </div>
            );
          })
        )}
      </Card>

      {adding && <TxFormModal eventId={ev.id} onClose={() => setAdding(false)} />}
      {editing && <TxFormModal eventId={ev.id} tx={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
