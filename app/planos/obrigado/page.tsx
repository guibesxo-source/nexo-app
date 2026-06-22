"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Volta do checkout da AbacatePay. A ativação real vem do webhook, que pode levar
// alguns segundos — então fazemos polling em /api/billing/status e mandamos pro
// app assim que a conta libera. Se demorar, mostramos um estado de "quase lá".
export default function ObrigadoPage() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let active = true;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { entitled?: boolean } | null;
        if (json?.entitled) {
          window.location.replace("/dashboard");
          return;
        }
      } catch {
        /* rede instável — tenta de novo */
      }
      if (!active) return;
      if (tries >= 20) setSlow(true); // ~40s sem confirmar
      else setTimeout(tick, 2000);
    };
    tick();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 shadow-[var(--shadow-md)]">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-soft">
          <span
            className="h-7 w-7 animate-spin rounded-full border-[3px] border-green-deep/30 border-t-green-deep"
            aria-hidden
          />
        </span>
        {!slow ? (
          <>
            <h1 className="text-xl font-extrabold tracking-[-0.03em]">Confirmando seu pagamento…</h1>
            <p className="mt-2 text-[13px] text-dim">
              Assim que a AbacatePay confirmar, sua conta libera automaticamente e você cai no app.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold tracking-[-0.03em]">Quase lá!</h1>
            <p className="mt-2 text-[13px] text-dim">
              A confirmação pode levar alguns instantes. Você pode ir para o app — se ainda não
              tiver liberado, é só recarregar em seguida.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex w-full items-center justify-center rounded-sm bg-green px-4 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
            >
              Ir para o app
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
