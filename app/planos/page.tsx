import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentSubscription } from "@/lib/billing/server";
import { isEntitled, isTrialing, trialDaysLeft } from "@/lib/billing/entitlement";
import { FOUNDER_PLAN, type Cycle } from "@/lib/billing/plan";
import { PlanSelector } from "./plan-selector";

export const metadata: Metadata = { title: "Planos — Nexo" };

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const sub = await getCurrentSubscription();
  const active = !!sub && sub.status === "active" && isEntitled(sub);
  const trialing = isTrialing(sub);
  const expired = !!sub && !isEntitled(sub);
  const days = trialDaysLeft(sub);

  // ciclo escolhido no site viaja em ?cycle; padrão anual (oferta principal).
  const sp = await searchParams;
  const initialCycle: Cycle = sp.cycle === "mensal" ? "mensal" : "anual";

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full opacity-25 blur-[90px]"
        style={{ background: "radial-gradient(circle, #00e47c, transparent 65%)" }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-extrabold tracking-[-0.03em]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-black">
            <span className="h-2.5 w-2.5 rounded-full bg-green shadow-[0_0_0_2.5px_#000,0_0_0_4px_#00e47c]" />
          </span>
          Nexo
        </div>

        {active ? (
          <div className="mb-5 rounded-md border border-green/30 bg-green-soft px-4 py-3 text-center text-[13px] font-semibold text-green-deep">
            Sua assinatura está ativa. <Link href="/dashboard" className="underline">Ir para o app →</Link>
          </div>
        ) : trialing ? (
          <div className="mb-5 rounded-md border border-black/10 bg-white px-4 py-3 text-center text-[13px] text-muted">
            Você está no teste grátis — {days === 1 ? "falta 1 dia" : `faltam ${days} dias`}. Garanta seu preço de fundador.
          </div>
        ) : expired ? (
          <div className="mb-5 rounded-md border border-amber/30 bg-amber-soft px-4 py-3 text-center text-[13px] font-semibold text-amber">
            Seu teste acabou. Assine o plano Fundador para voltar a usar o Nexo.
          </div>
        ) : null}

        <PlanSelector initialCycle={initialCycle} />

        <p className="mx-auto mt-5 max-w-sm text-center text-[12px] text-faint">
          {FOUNDER_PLAN.tagline}
        </p>

        <p className="mt-4 text-center text-[12px] text-faint">
          <Link href="/dashboard" className="hover:underline">Voltar ao app</Link>
        </p>
      </div>
    </main>
  );
}
