"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Faixa fina no topo do app durante o teste grátis: conta os dias restantes e
// leva pra /planos. Lê o estado real em /api/billing/status (a fonte é a tabela
// subscriptions). Some quando a assinatura já está ativa.
export function TrialBanner() {
  const [info, setInfo] = useState<{ status: string | null; trialDaysLeft: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => active && setInfo(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!info || info.status !== "trialing") return null;
  const d = info.trialDaysLeft;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-[12.5px] font-semibold text-white">
      <span>
        <span className="mr-1.5 text-green">●</span>
        Teste grátis — {d === 1 ? "falta 1 dia" : `faltam ${d} dias`}. Garanta seu preço de fundador.
      </span>
      <Link
        href="/planos"
        className="rounded-full bg-green px-3 py-1 text-[11.5px] font-bold text-black transition hover:bg-green-deep"
      >
        Virar fundador
      </Link>
    </div>
  );
}
