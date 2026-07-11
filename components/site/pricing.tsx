"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Lock } from "lucide-react";
import { FOUNDER_PLAN, FREE_BETA_OFFER, type Cycle } from "@/lib/billing/plan";

/* Preços na fase de BETA GRATUITO (ADR-004): o card central vende o beta —
   R$ 0, por tempo indeterminado — e os planos Fundador REAIS da AbacatePay
   (Mensal R$ 49 cartão · Anual R$ 588 PIX/cartão) ficam lado a lado com cara
   de "ainda não desbloqueado" (apagados; acendem no hover). O CTA deles vai
   pro checkout certo (/planos?cycle=...) — pagar é opcional no beta. */

/** Plano Fundador real (produto da Abacate), exibido "bloqueado" no beta. */
function FounderCard({ cycle }: { cycle: Cycle }) {
  const c = FOUNDER_PLAN.cycles[cycle];
  return (
    <div className="price-card price-anchor price-locked flex flex-col rounded-xl border border-black/10 bg-white p-7">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-[#f2f2f0] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">
          Fundador · {c.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-faint">
          <Lock className="h-3 w-3" /> opcional no beta
        </span>
      </div>

      <div className="mt-5 flex items-end gap-1.5">
        <span className="text-4xl font-extrabold tracking-[-0.03em] text-ink">{c.priceLabel}</span>
        <span className="pb-1 text-sm font-semibold text-dim">{c.period}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-dim">{c.note} · {c.methodsBadge}</p>

      <ul className="mt-5 grid gap-2">
        {c.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-muted">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-deep" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <Link
          href={`/planos?cycle=${cycle}`}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-black/15 px-4 py-2.5 text-[13px] font-bold text-ink transition hover:border-black hover:bg-black hover:text-white"
        >
          <Lock className="h-3.5 w-3.5" /> Travar preço de fundador
        </Link>
        <p className="mt-2 text-center text-[11px] text-faint">
          Não precisa pagar no beta — o Nexo está grátis.
        </p>
      </div>
    </div>
  );
}

export function SitePricing() {
  const [inView, setInView] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reveal por scroll: a grade entra em cascata quando a seção aparece.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const beta = FREE_BETA_OFFER;

  return (
    <div
      ref={gridRef}
      className={
        "price-grid mx-auto mt-12 grid max-w-5xl items-stretch gap-5 md:grid-cols-3" +
        (inView ? " in" : "")
      }
    >
      <FounderCard cycle="mensal" />

      {/* Beta gratuito — a oferta vigente */}
      <div className="price-card price-featured relative order-first overflow-hidden rounded-xl p-7 text-white md:order-none">
        <span className="price-glow" aria-hidden />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-green px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-black">
              {beta.tag}
            </span>
            <span className="text-[12px] font-semibold text-white/45 line-through decoration-white/30">
              R$ 89/mês
            </span>
          </div>

          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-extrabold tracking-[-0.03em]">{beta.priceLabel}</span>
            <span className="pb-1.5 text-sm font-semibold text-white/55">{beta.period}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-white/55">{beta.note}</p>

          <ul className="mt-5 grid gap-2">
            {beta.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-white/90">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-5">
            <div className="rounded-md border border-green/30 bg-green/10 px-3.5 py-2.5 text-[12px] font-medium leading-snug text-green">
              {beta.feedbackLine}
            </div>

            <Link
              href="/login"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-green px-4 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
            >
              {beta.cta} <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-center text-[11.5px] text-white/40">{beta.tagline}</p>
          </div>
        </div>
      </div>

      <FounderCard cycle="anual" />

      <p className="text-center text-[12px] text-faint md:col-span-3">
        Os planos Fundador são os preços reais já configurados no checkout — pagar é opcional
        enquanto o beta for gratuito, e quem travar fica em R$ 49/mês para sempre. Preço público
        futuro de referência: R$ 89/mês.
      </p>
    </div>
  );
}
