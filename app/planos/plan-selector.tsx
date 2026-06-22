"use client";

import { useState } from "react";
import { FOUNDER_PLAN, payLabel, type Cycle, type Method } from "@/lib/billing/plan";

function Check() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-green-deep"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Card do plano Fundador com toggle Mensal/Anual. Ao escolher o método, pede o
// checkout à API e redireciona pro Abacate. A liberação vem do webhook.
export function PlanSelector({ initialCycle }: { initialCycle: Cycle }) {
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [busy, setBusy] = useState<Method | null>(null);
  const [error, setError] = useState("");

  const c = FOUNDER_PLAN.cycles[cycle];
  const primary = c.methods[0];

  const go = async (method: Method) => {
    setBusy(method);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle, method }),
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setError(json?.error ?? "Não consegui abrir o checkout. Tente de novo.");
        setBusy(null);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError("Falha de conexão — tente de novo.");
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-black/10 bg-white p-7 shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-2">
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
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition " +
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
        <span className="text-4xl font-extrabold tracking-[-0.03em]">{c.priceLabel}</span>
        <span className="pb-1 text-sm font-semibold text-dim">{c.period}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-dim">{c.note}</p>

      <ul className="mt-5 grid gap-2.5">
        {FOUNDER_PLAN.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-ink">
            <Check />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-md border border-green/30 bg-green-soft px-3.5 py-2.5 text-[12px] font-medium leading-snug text-green-deep">
        {FOUNDER_PLAN.lockLine}
      </div>

      <div className="mt-5 grid gap-3">
        {c.methods.map((m) => (
          <button
            key={m}
            onClick={() => go(m)}
            disabled={busy !== null}
            className={
              "flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm font-bold transition disabled:opacity-60 " +
              (m === primary
                ? "bg-green text-black hover:bg-green-deep"
                : "border border-black/15 bg-white text-ink hover:border-black")
            }
          >
            {busy === m ? "Abrindo checkout…" : payLabel(cycle, m)}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-center text-xs font-medium text-red">{error}</p>}
      <p className="mt-3 text-center text-[11.5px] text-faint">
        Pagamento seguro via AbacatePay. No PIX, o acesso libera assim que o pagamento é confirmado.
      </p>
    </div>
  );
}
