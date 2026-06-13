"use client";

// Boas-vindas pós-cadastro (rota logada, protegida pelo proxy). Saúda pelo
// nome e leva ao dashboard. Fora do AppShell de propósito — é um "momento".
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromUser } from "@/lib/auth";

const STEPS = [
  { icon: "🗓️", title: "Crie seu evento", desc: "Tudo no Nexo gira em torno do evento — comece por ele." },
  { icon: "🎫", title: "Traga seus inscritos", desc: "Importe por CSV, Sympla ou HubSpot e acompanhe confirmações." },
  { icon: "✅", title: "Monte o checklist", desc: "Pré, durante e pós — com prazos e custos que alimentam o financeiro." },
];

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) router.replace("/login");
      else setName(displayNameFromUser(user));
    });
    return () => { active = false; };
  }, [router]);

  if (!name) return null;
  const firstName = name.split(" ")[0];

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* brilho de marca sutil ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full opacity-30 blur-[90px]"
        style={{ background: "radial-gradient(circle, #00e47c, transparent 65%)" }}
      />

      <div className="relative w-full max-w-lg text-center">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-extrabold tracking-[-0.03em]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-black">
            <span className="h-2.5 w-2.5 rounded-full bg-green shadow-[0_0_0_2.5px_#000,0_0_0_4px_#00e47c]" />
          </span>
          Nexo
        </div>

        <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">
          Bem-vindo, {firstName} 👋
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-dim">
          Sua conta está pronta. O Nexo reúne inscritos, checklist e financeiro de cada
          evento num só painel — vamos colocar o seu primeiro no ar.
        </p>

        <div className="mt-9 grid gap-3 text-left">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="flex items-start gap-3 rounded-[14px] border border-black/10 bg-white p-4"
            >
              <span className="text-xl leading-none">{s.icon}</span>
              <div>
                <div className="text-sm font-bold">{s.title}</div>
                <div className="mt-0.5 text-[12.5px] text-dim">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-9 w-full rounded-sm bg-green px-4 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
        >
          Começar agora
        </button>
      </div>
    </main>
  );
}
