"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { FOUNDER_PLAN, type Cycle } from "@/lib/billing/plan";

// Card de preços do site com toggle Mensal/Anual. O ciclo escolhido viaja no CTA
// até o login (?next=/planos?cycle=...), pra retomar o pagamento já no ciclo certo.
export function SitePricing() {
  const [cycle, setCycle] = useState<Cycle>("anual");
  const c = FOUNDER_PLAN.cycles[cycle];
  // Vai direto pra página de pagamento (logado → pagamento; deslogado → cria a
  // conta e o proxy devolve aqui via ?next).
  const href = `/planos?cycle=${cycle}`;

  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-black/10 bg-white p-8 shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-green-deep">
          Plano {FOUNDER_PLAN.name}
        </span>
        <span className="text-[12px] font-semibold text-dim line-through decoration-black/30">
          {FOUNDER_PLAN.publicMonthly}
        </span>
      </div>

      {/* Toggle Mensal / Anual */}
      <div className="mt-4 inline-flex rounded-full border border-black/10 bg-[#f2f2f0] p-0.5">
        {(["mensal", "anual"] as Cycle[]).map((k) => (
          <button
            key={k}
            onClick={() => setCycle(k)}
            className={
              "rounded-full px-4 py-1.5 text-[13px] font-bold transition " +
              (cycle === k ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-dim hover:text-ink")
            }
          >
            {FOUNDER_PLAN.cycles[k].label}
            {k === "anual" && (
              <span className="ml-1.5 rounded-full bg-green px-1.5 py-0.5 text-[9.5px] font-bold text-black">
                PIX
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        <span className="text-5xl font-extrabold tracking-[-0.03em]">{c.priceLabel}</span>
        <span className="pb-1.5 text-sm font-semibold text-dim">{c.period}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-dim">{c.note}</p>

      <ul className="mt-6 grid gap-2.5">
        {FOUNDER_PLAN.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-deep" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-md border border-green/30 bg-green-soft px-3.5 py-2.5 text-[12px] font-medium leading-snug text-green-deep">
        {FOUNDER_PLAN.lockLine}
      </div>

      <Link
        href={href}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-sm bg-green px-4 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
      >
        Quero ser fundador <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        7 dias grátis para testar · {FOUNDER_PLAN.tagline}
      </p>
    </div>
  );
}
