"use client";

/* Financeiro — FR-E1..E4: orçamento, lançamentos entrada/saída com
   categoria e status de pagamento, gasto por categoria e relatório CSV. */
import { useRef, useState } from "react";
import {
  Badge, Card, Donut, Empty, Field, Icon, Kpi, Menu, Modal, MoneyInput, PageHead, useToast,
} from "@/components/app/kit";
import { CostPanel } from "@/components/app/cost-panel";
import {
  addTransaction,
  categoryById,
  categoryTotals,
  eventKpis,
  PAYMENT_META,
  removeTransaction,
  selectedEvent,
  setBudget,
  setTransactionFile,
  txOf,
  updateTransaction,
  useDb,
} from "@/lib/db";
import { transactionSchema } from "@/lib/validations/transaction";
import { downloadCsv, toCsv } from "@/lib/csv";
import { compressImage, downloadDataUrl, fileToDataUrl } from "@/lib/files";
import { fmtDateShort, fmtMoney, fmtMoneyFull } from "@/lib/format";
import type { Transaction, TxKind, TxPayment } from "@/types";

type DocFile = { name: string; data: string };

/** Lê NF/boleto: imagem é comprimida; PDF entra como está (limite da fase local). */
async function readDocFile(file: File): Promise<DocFile> {
  if (file.type.startsWith("image/")) {
    return { name: file.name, data: await compressImage(file, 1400, 0.8) };
  }
  if (file.type === "application/pdf") {
    if (file.size > 1.5 * 1024 * 1024) {
      throw new Error("PDF muito grande — máximo ~1,5 MB nesta fase local");
    }
    return { name: file.name, data: await fileToDataUrl(file) };
  }
  throw new Error("Anexe um PDF ou uma imagem");
}

function AttachDocField({ label, short, value, onChange }: {
  label: string; short: string; value: DocFile | null; onChange: (v: DocFile | null) => void;
}) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label={label}>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onChange(await readDocFile(f));
          } catch (err) {
            toast(err instanceof Error ? err.message : "Não consegui ler esse arquivo");
          }
        }}
      />
      {value ? (
        <div className="nf-file">
          <Icon name="paperclip" size={15} />
          <span className="nm" title={value.name}>{value.name}</span>
          <button type="button" className="row-action" title="Remover anexo" onClick={() => onChange(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <button type="button" className="btn" style={{ width: "100%" }} onClick={() => ref.current?.click()}>
          <Icon name="upload" size={15} />Upar {short}
        </button>
      )}
    </Field>
  );
}

function TxFormModal({ eventId, tx, onClose }: {
  eventId: string; tx?: Transaction; onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const editing = !!tx;
  const [form, setForm] = useState({
    description: tx?.description ?? "",
    amount_cents: tx ? Math.round(tx.amount * 100) : 0,
    kind: tx?.kind ?? ("saida" as TxKind),
    category_id: tx?.category_id ?? db.categories[0]?.id ?? "",
    payment_status: tx?.payment_status ?? ("pendente" as TxPayment),
    invoice_ref: tx?.invoice_ref ?? "",
    occurred_on: tx?.occurred_on ?? new Date().toISOString().slice(0, 10),
  });
  const [invoiceFile, setInvoiceFile] = useState<DocFile | null>(tx?.invoice_file ?? null);
  const [boletoFile, setBoletoFile] = useState<DocFile | null>(tx?.boleto_file ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const parsed = transactionSchema.safeParse({
      description: form.description,
      amount: form.amount_cents / 100,
      kind: form.kind,
      category_id: form.category_id || null,
      payment_status: form.payment_status,
      invoice_ref: form.invoice_ref,
      invoice_file: invoiceFile,
      boleto_file: boletoFile,
      occurred_on: form.occurred_on,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    if (editing) {
      updateTransaction(tx.id, parsed.data);
      toast("Lançamento atualizado");
    } else {
      addTransaction(eventId, parsed.data);
      toast("Lançamento adicionado");
    }
    onClose();
  };

  return (
    <Modal
      title={editing ? "Editar lançamento" : "Novo lançamento"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>{editing ? "Salvar" : "Lançar"}</button>
        </>
      }
    >
      <Field label="Descrição" error={errors.description}>
        <input
          className="input"
          placeholder="Ex.: Catering Bistro 320"
          value={form.description}
          onChange={set("description")}
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Tipo" error={errors.kind}>
          <select className="input" value={form.kind} onChange={set("kind")}>
            <option value="saida">Despesa (saída)</option>
            <option value="entrada">Receita (entrada)</option>
          </select>
        </Field>
        <Field label="Valor" error={errors.amount}>
          <MoneyInput
            cents={form.amount_cents}
            onCents={(c) => setForm((f) => ({ ...f, amount_cents: c }))}
          />
        </Field>
        <Field label="Categoria" error={errors.category_id}>
          <select className="input" value={form.category_id} onChange={set("category_id")}>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Status de pagamento" error={errors.payment_status}>
          <select className="input" value={form.payment_status} onChange={set("payment_status")}>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="recebido">Recebido</option>
          </select>
        </Field>
        <Field label="NF (opcional)" error={errors.invoice_ref}>
          <input className="input" placeholder="Ex.: NF #2241" value={form.invoice_ref} onChange={set("invoice_ref")} />
        </Field>
        <Field label="Data" error={errors.occurred_on}>
          <input className="input" type="date" value={form.occurred_on} onChange={set("occurred_on")} />
        </Field>
      </div>
      <div className="form-grid">
        <AttachDocField label="Arquivo da NF (PDF/imagem)" short="NF" value={invoiceFile} onChange={setInvoiceFile} />
        <AttachDocField label="Boleto (PDF/imagem)" short="boleto" value={boletoFile} onChange={setBoletoFile} />
      </div>
    </Modal>
  );
}

function BudgetModal({ eventId, current, onClose }: {
  eventId: string; current: number; onClose: () => void;
}) {
  const toast = useToast();
  const [cents, setCents] = useState(Math.round(current * 100));
  const [error, setError] = useState("");

  const submit = () => {
    const n = cents / 100;
    if (!Number.isFinite(n) || n < 0) {
      setError("Informe um valor válido");
      return;
    }
    setBudget(eventId, n);
    toast("Orçamento atualizado");
    onClose();
  };

  return (
    <Modal
      title="Orçamento do evento"
      onClose={onClose}
      width={380}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Salvar</button>
        </>
      }
    >
      <Field label="Orçamento previsto" error={error} style={{ marginBottom: 0 }}>
        <MoneyInput cents={cents} onCents={setCents} autoFocus />
      </Field>
    </Modal>
  );
}

const SEGMENTS: [string, string][] = [
  ["todos", "Todos"],
  ["despesas", "Despesas"],
  ["receitas", "Receitas"],
];

/* ---------- Proposto × Realizado ---------- */

/** Linha do realizado acumulado com a linha tracejada do proposto. */
function CompareLine({ points, budget }: { points: number[]; budget: number }) {
  const w = 600, h = 240, padX = 4, padTop = 16, padBot = 8;
  // folga de 6% no teto para a linha do proposto não encostar na borda
  const max = Math.max(budget, ...points, 1) * 1.06;
  const x = (i: number) => padX + (i / Math.max(points.length - 1, 1)) * (w - padX * 2);
  const y = (v: number) => padTop + (1 - v / max) * (h - padTop - padBot);
  const line = points
    .map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p).toFixed(1))
    .join(" ");
  const area = line + ` L${x(points.length - 1).toFixed(1)} ${h - padBot} L${padX} ${h - padBot} Z`;
  return (
    <svg className="cmp-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cmpg" x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor="#00E47C" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#00E47C" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* grade horizontal sutil */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={padX} x2={w - padX} y1={y(max * f)} y2={y(max * f)}
          stroke="rgba(0,0,0,0.05)" vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1={padX} x2={w - padX} y1={h - padBot} y2={h - padBot}
        stroke="rgba(0,0,0,0.12)" vectorEffect="non-scaling-stroke"
      />
      <path d={area} fill="url(#cmpg)" />
      <path
        d={line}
        fill="none" stroke="#00B863" strokeWidth={2.4}
        strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={padX} x2={w - padX} y1={y(budget)} y2={y(budget)}
        stroke="#0A0A0A" strokeWidth={1.6} strokeDasharray="7 5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const CHART_MODES: [string, string][] = [
  ["barras", "Barras"],
  ["linha", "Linha"],
  ["donut", "Donut"],
];

function PropostoRealizado({ budget, spent, income, txs }: {
  budget: number; spent: number; income: number; txs: Transaction[];
}) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState("barras");

  const pct = budget ? Math.round((spent / budget) * 100) : 0;
  const max = Math.max(budget, spent, income, 1);

  // série acumulada das saídas em ordem cronológica (gráfico de linha)
  const outs = txs
    .filter((t) => t.kind === "saida")
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const series = outs.reduce<number[]>((arr, t) => {
    arr.push((arr[arr.length - 1] ?? 0) + t.amount);
    return arr;
  }, []);
  const linePoints = series.length >= 2 ? [0, ...series] : [0, spent];

  const bars = [
    { nm: "Proposto", v: budget, color: "var(--ink-3)" },
    { nm: "Realizado", v: spent, color: "var(--green)" },
    ...(income > 0 ? [{ nm: "Receitas", v: income, color: "var(--blue)" }] : []),
  ];

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="cmp-head">
        <div>
          <div className="card-title">Proposto × Realizado</div>
          <div className="cmp-sub">
            {fmtMoney(spent)} de {fmtMoney(budget)} ·{" "}
            <b style={{ color: pct > 100 ? "var(--red)" : "var(--green-deep)" }}>{pct}%</b> do proposto
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {open && (
            <div className="seg">
              {CHART_MODES.map(([id, label]) => (
                <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            className="tb-icon-btn"
            title={open ? "Retrair" : "Expandir"}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "chevUp" : "chevDown"} size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="cmp-body">
          {mode === "barras" && (
            <div className="cmp-bars">
              {bars.map((b) => (
                <div className="cmp-bar-row" key={b.nm}>
                  <span className="nm">{b.nm}</span>
                  <div className="bar">
                    <i style={{ width: Math.round((b.v / max) * 100) + "%", background: b.color }} />
                  </div>
                  <span className="vl">{fmtMoney(b.v)}</span>
                </div>
              ))}
            </div>
          )}

          {mode === "linha" && (
            <div className="cmp-line-wrap">
              <CompareLine points={linePoints} budget={budget} />
              <div className="cmp-legend">
                <span className="row" style={{ gap: 7 }}>
                  <span className="sw" style={{ background: "var(--green)" }} />
                  Realizado acumulado
                </span>
                <span className="row" style={{ gap: 7 }}>
                  <span className="sw sw-dash" />
                  Proposto ({fmtMoney(budget)})
                </span>
              </div>
            </div>
          )}

          {mode === "donut" && (
            <div className="cmp-donut">
              <Donut
                pct={Math.min(100, pct)}
                label="realizado"
                size={196}
                legend={[
                  { color: "var(--green)", label: "Realizado", value: fmtMoney(spent) },
                  { color: "#E8E8E5", label: "Disponível", value: fmtMoney(Math.max(0, budget - spent)) },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------- modal: resumo de um KPI (despesas / receitas / pendente) ---------- */

type FinanceDetailKind = "despesas" | "receitas" | "pendente";

const FINANCE_DETAIL_META: Record<FinanceDetailKind, { title: string; desc: string }> = {
  despesas: { title: "Total de despesas", desc: "Tudo que saiu do caixa do evento." },
  receitas: { title: "Receitas", desc: "Tudo que entrou — patrocínios, vendas e repasses." },
  pendente: { title: "Pendente de pagamento", desc: "Despesas registradas e ainda não pagas." },
};

function FinanceDetailModal({ kind, txs, db, onClose }: {
  kind: FinanceDetailKind;
  txs: Transaction[];
  db: ReturnType<typeof useDb>;
  onClose: () => void;
}) {
  const meta = FINANCE_DETAIL_META[kind];
  const isIn = kind === "receitas";
  const list = (
    kind === "receitas"
      ? txs.filter((t) => t.kind === "entrada")
      : kind === "pendente"
        ? txs.filter((t) => t.kind === "saida" && t.payment_status === "pendente")
        : txs.filter((t) => t.kind === "saida")
  )
    .slice()
    .sort((a, b) => b.amount - a.amount);
  const total = list.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Modal
      title={meta.title}
      onClose={onClose}
      width={560}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <div className="fd-summary">
        <div className="fd-sum-main">
          <div className="fd-sum-lbl">{meta.desc}</div>
          <div className={"fd-sum-val" + (isIn ? " in" : "")}>{fmtMoney(total)}</div>
        </div>
        <span className="fd-sum-count">{list.length} lançamento{list.length === 1 ? "" : "s"}</span>
      </div>
      {list.length === 0 ? (
        <Empty icon="wallet" title="Nada por aqui" sub="Nenhum lançamento neste grupo ainda." />
      ) : (
        <div className="fd-list">
          {list.map((t) => {
            const cat = categoryById(db, t.category_id);
            const pay = PAYMENT_META[t.payment_status] ?? { tone: "gray", label: t.payment_status };
            return (
              <div className="fd-row" key={t.id}>
                <span className="fd-ic">{cat?.icon ?? (isIn ? "💰" : "💳")}</span>
                <span className="fd-main">
                  <span className="fd-nm">{t.description}</span>
                  <span className="fd-meta">{[cat?.name, fmtDateShort(t.occurred_on)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="fd-amt">
                  <span className={"fd-v" + (isIn ? " in" : "")}>{isIn ? "+" : "−"}{fmtMoney(t.amount)}</span>
                  <Badge tone={pay.tone}>{pay.label}</Badge>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export function Financeiro() {
  const db = useDb();
  const toast = useToast();
  const budgetRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const pendingAttach = useRef<{ id: string; field: "invoice_file" | "boleto_file" } | null>(null);
  const [seg, setSeg] = useState("todos");
  const [adding, setAdding] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [detail, setDetail] = useState<FinanceDetailKind | null>(null);

  const ev = selectedEvent(db);

  // Anexar NF/boleto a um lançamento já criado (menu da linha → input único).
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

  // Mesmo efeito reativo do login: o card segue o mouse via CSS vars.
  const onBudgetMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = budgetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--px", (x * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (y * 2 - 1).toFixed(3));
  };

  const onBudgetLeave = () => {
    const el = budgetRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "75%");
    el.style.setProperty("--my", "25%");
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  };

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Financeiro" sub="Nenhum evento criado ainda" />
        <Empty icon="wallet" title="Crie um evento primeiro" sub="O financeiro pertence a um evento." />
      </div>
    );
  }

  const k = eventKpis(db, ev.id);
  const cats = categoryTotals(db, ev.id);
  const txs = txOf(db, ev.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const list = txs.filter(
    (t) =>
      seg === "todos" ||
      (seg === "despesas" && t.kind === "saida") ||
      (seg === "receitas" && t.kind === "entrada")
  );
  const outCount = txs.filter((t) => t.kind === "saida").length;
  const inCount = txs.filter((t) => t.kind === "entrada").length;
  const pendingCount = txs.filter((t) => t.kind === "saida" && t.payment_status === "pendente").length;

  // Análise orçamento × custos × receitas para o hero.
  const budget = ev.budget_planned;
  const net = k.income - k.spent;
  const coverage = k.spent ? Math.round((k.income / k.spent) * 100) : k.income > 0 ? 100 : 0;
  const finMax = Math.max(budget, k.spent, k.income, 1);
  const finPct = (v: number) => (v <= 0 ? 0 : Math.max(3, Math.round((v / finMax) * 100)));
  const finNote =
    budget > 0 && k.spent > budget
      ? { tone: "warn", text: `Estourou o orçamento em ${fmtMoney(k.spent - budget)}` }
      : k.income <= 0
        ? { tone: "info", text: `Sem receitas ainda · ${fmtMoney(Math.max(0, k.available))} do orçamento livres` }
        : net >= 0
          ? { tone: "pos", text: `Receitas cobrem os custos · resultado +${fmtMoney(net)}` }
          : { tone: "warn", text: `Receitas cobrem ${coverage}% dos custos · faltam ${fmtMoney(-net)}` };

  const exportCsv = () => {
    const csv = toCsv(
      ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Pagamento", "NF"],
      txs.map((t) => [
        t.occurred_on,
        t.description,
        categoryById(db, t.category_id)?.name ?? "",
        t.kind,
        (t.kind === "saida" ? -t.amount : t.amount).toFixed(2).replace(".", ","),
        PAYMENT_META[t.payment_status]?.label ?? t.payment_status,
        t.invoice_ref ?? "",
      ])
    );
    downloadCsv(`nexo-financeiro-${ev.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Relatório financeiro exportado (CSV)");
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
        title="Financeiro"
        sub={`${ev.name} · Orçamento ${fmtMoney(ev.budget_planned)}`}
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={txs.length === 0}>
              <Icon name="download" size={15} />Relatório
            </button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} />Lançamento
            </button>
          </>
        }
      />

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div
          className="budget-card"
          ref={budgetRef}
          onMouseMove={onBudgetMove}
          onMouseLeave={onBudgetLeave}
        >
          <span className="bc-spot" />
          <div className="lbl">Gasto até agora</div>
          <div className="big">
            {fmtMoney(Math.trunc(k.spent))}
            <span className="cents">
              {fmtMoneyFull(k.spent).slice(-3).replace(".", ",")}
            </span>
          </div>
          <div className="sub">
            {k.budgetPct}% do orçamento · {fmtMoney(Math.abs(k.available))} {k.available >= 0 ? "disponível" : "acima do previsto"}
          </div>
          <div className="bc-bars">
            <div className="bc-bar-row">
              <span className="bc-bk">Orçamento</span>
              <span className="bc-track"><i className="bud" style={{ width: finPct(budget) + "%" }} /></span>
              <span className="bc-bv">{fmtMoney(budget)}</span>
            </div>
            <div className="bc-bar-row">
              <span className="bc-bk">Custos</span>
              <span className="bc-track">
                <i className={"cost" + (budget > 0 && k.spent > budget ? " over" : "")} style={{ width: finPct(k.spent) + "%" }} />
              </span>
              <span className="bc-bv">{fmtMoney(k.spent)}</span>
            </div>
            <div className="bc-bar-row">
              <span className="bc-bk">Receitas</span>
              <span className="bc-track"><i className="rev" style={{ width: finPct(k.income) + "%" }} /></span>
              <span className="bc-bv">{fmtMoney(k.income)}</span>
            </div>
          </div>
          <div className={"bc-note " + finNote.tone}>
            <Icon name="bolt" size={14} />
            <span>{finNote.text}</span>
          </div>
          <button
            className="btn btn-sm"
            style={{ marginTop: 16, position: "relative", zIndex: 1 }}
            onClick={() => setEditingBudget(true)}
          >
            Editar orçamento
          </button>
        </div>
        <Card
          title="Por categoria"
          actions={
            cats.length > 0 ? (
              <span className="card-link">{fmtMoney(k.spent)} · {outCount} lançamento{outCount === 1 ? "" : "s"}</span>
            ) : undefined
          }
        >
          {cats.length === 0 ? (
            <Empty icon="wallet" title="Sem despesas ainda" sub="Os gastos por categoria aparecem aqui." />
          ) : (
            <div className="catx-list">
              {cats.map((c) => (
                <div className="catx-row" key={c.id}>
                  <span className="catx-ic">{c.icon}</span>
                  <span className="catx-main">
                    <span className="catx-top">
                      <span className="catx-nm">{c.name}</span>
                      <span className="catx-vl">{fmtMoney(c.value)}</span>
                    </span>
                    <span className="catx-bar"><i style={{ width: Math.max(3, c.share) + "%" }} /></span>
                    <span className="catx-sub">
                      {c.share}% do gasto · {c.count} lançamento{c.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <PropostoRealizado budget={ev.budget_planned} spent={k.spent} income={k.income} txs={txs} />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <Kpi
          icon="arrowDown"
          value={fmtMoney(k.spent)}
          label="Total de despesas"
          delta={`${outCount} lançamento${outCount === 1 ? "" : "s"}`}
          deltaDir="flat"
          onClick={() => setDetail("despesas")}
        />
        <Kpi
          icon="arrowUp" iconTone="green"
          value={fmtMoney(k.income)}
          label="Receitas"
          delta={`${inCount} lançamento${inCount === 1 ? "" : "s"}`}
          deltaDir={inCount > 0 ? "up" : "flat"}
          onClick={() => setDetail("receitas")}
        />
        <Kpi
          icon="clock"
          value={fmtMoney(k.pendingPay)}
          label="Pendente de pagamento"
          delta={`${pendingCount} lançamento${pendingCount === 1 ? "" : "s"}`}
          deltaDir="flat"
          onClick={() => setDetail("pendente")}
        />
      </div>

      <Card title="Custo por inscrito" style={{ marginTop: 4 }}>
        <CostPanel k={k} capacity={ev.capacity} />
      </Card>

      <Card pad0 style={{ marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--line)" }}>
          <div className="card-title">Lançamentos</div>
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
            icon="wallet"
            title="Nenhum lançamento"
            sub="Registre despesas e receitas para acompanhar o orçamento."
            action={
              <button className="btn btn-primary" onClick={() => setAdding(true)}>
                <Icon name="plus" size={15} />Primeiro lançamento
              </button>
            }
          />
        ) : (
          list.map((t) => {
            const cat = categoryById(db, t.category_id);
            const pay = PAYMENT_META[t.payment_status] ?? { tone: "gray", label: t.payment_status };
            const dir = t.kind === "entrada" ? "in" : "out";
            return (
              <div className="tx-row" key={t.id}>
                <span className="tx-ic">{cat?.icon ?? "💳"}</span>
                <div>
                  <div className="ttl">{t.description}</div>
                  <div className="meta">
                    {[cat?.name, t.invoice_ref, fmtDateShort(t.occurred_on)].filter(Boolean).join(" · ")}
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
                <Badge tone={pay.tone}>{pay.label}</Badge>
                <span className="row" style={{ gap: 4 }}>
                  <span className={"tx-amt " + dir}>
                    {dir === "in" ? "+ " : "- "}{fmtMoneyFull(t.amount)}
                  </span>
                  <Menu
                    items={[
                      {
                        label: "Editar lançamento",
                        onClick: () => setEditingTx(t),
                      },
                      {
                        label: t.invoice_file ? "Trocar NF (arquivo)" : "Upar NF",
                        onClick: () => pickAttach(t.id, "invoice_file"),
                      },
                      {
                        label: t.boleto_file ? "Trocar boleto" : "Upar boleto",
                        onClick: () => pickAttach(t.id, "boleto_file"),
                      },
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
      {editingTx && (
        <TxFormModal eventId={ev.id} tx={editingTx} onClose={() => setEditingTx(null)} />
      )}
      {editingBudget && (
        <BudgetModal eventId={ev.id} current={ev.budget_planned} onClose={() => setEditingBudget(false)} />
      )}
      {detail && (
        <FinanceDetailModal kind={detail} txs={txs} db={db} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
