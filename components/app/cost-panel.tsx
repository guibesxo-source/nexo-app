/* Painel focado em "custo por inscrito" — o número principal e seus
   desdobramentos (por confirmado, receita/inscrito, resultado/inscrito,
   custo-alvo na lotação) + comparação visual custo × receita por inscrito.
   Reaproveitado no dashboard (widget "block-cost") e no Financeiro. */
import { Icon } from "./kit";
import { fmtMoney } from "@/lib/format";
import type { EventKpis } from "@/lib/db";

export function CostPanel({ k, capacity }: { k: EventKpis; capacity?: number | null }) {
  const result = k.resultPerAttendee;
  const max = Math.max(k.costPerAttendee, k.revenuePerAttendee, 1);
  const verdict = k.total === 0
    ? null
    : result >= 0
      ? { tone: "pos", text: `Cada inscrito gera ${fmtMoney(result)} de resultado positivo.` }
      : { tone: "neg", text: `Cada inscrito custa ${fmtMoney(-result)} a mais do que gera.` };
  const stats: { l: string; v: string; tone?: "pos" | "neg" }[] = [
    { l: "Por confirmado", v: fmtMoney(k.costPerConfirmed) },
    { l: "Receita / inscrito", v: fmtMoney(k.revenuePerAttendee), tone: k.revenuePerAttendee > 0 ? "pos" : undefined },
    { l: "Resultado / inscrito", v: (result > 0 ? "+" : "") + fmtMoney(result), tone: result >= 0 ? "pos" : "neg" },
    capacity
      ? { l: "Custo-alvo na lotação", v: fmtMoney(k.targetCostPerAttendee) }
      : { l: "Por check-in", v: k.checkin ? fmtMoney(Math.round(k.spent / k.checkin)) : "—" },
  ];

  return (
    <div className="cpa">
      <div className="cpa-hero">
        <div className="cpa-hero-val">{fmtMoney(k.costPerAttendee)}</div>
        <div className="cpa-hero-lbl">
          {k.total} inscrito{k.total === 1 ? "" : "s"} · {fmtMoney(k.spent)} em produção
        </div>
      </div>

      <div className="cpa-stats">
        {stats.map((s, i) => (
          <div className="cpa-stat" key={i}>
            <div className={"v" + (s.tone ? " " + s.tone : "")}>{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="cpa-cmp">
        <div className="cpa-cmp-row">
          <span className="cpa-cmp-lbl">Custo</span>
          <span className="cpa-cmp-track">
            <i className="cost" style={{ width: (k.costPerAttendee / max) * 100 + "%" }} />
          </span>
          <span className="cpa-cmp-val">{fmtMoney(k.costPerAttendee)}</span>
        </div>
        <div className="cpa-cmp-row">
          <span className="cpa-cmp-lbl">Receita</span>
          <span className="cpa-cmp-track">
            <i className="rev" style={{ width: (k.revenuePerAttendee / max) * 100 + "%" }} />
          </span>
          <span className="cpa-cmp-val">{fmtMoney(k.revenuePerAttendee)}</span>
        </div>
      </div>

      {verdict && (
        <div className={"cpa-note " + verdict.tone}>
          <Icon name="bolt" size={14} />
          <span>{verdict.text}</span>
        </div>
      )}
    </div>
  );
}
