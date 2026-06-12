"use client";

// Login demo (sem senha): cria a sessão local e leva à área logada.
// Será substituído por Supabase Auth na fase do banco (FR-A1) — o fluxo
// de UI (formulário → sessão → /dashboard) permanece o mesmo.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getState } from "@/lib/db/store";
import { hydrate, login, useDb, useHydrated } from "@/lib/db";

function LoginForm() {
  const router = useRouter();
  // Montado só depois da hidratação — pode ler o store no init do estado.
  const owner = getState().members.find((m) => m.role === "owner");
  const [name, setName] = useState(owner?.name ?? "");
  const [email, setEmail] = useState(owner?.email ?? "");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const em = email.trim();
    if (n.length < 2) {
      setError("Informe seu nome");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(em)) {
      setError("Informe um email válido");
      return;
    }
    login(n, em);
    router.push("/dashboard");
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-7 shadow-[var(--shadow-md)]"
    >
      <h1 className="text-xl font-extrabold tracking-[-0.03em]">Entrar</h1>
      <p className="mt-1 mb-6 text-[13px] text-dim">
        Acesso demo — sem senha. O login real (Supabase Auth) chega com o banco.
      </p>

      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">Seu nome</label>
      <input
        className="mb-4 w-full rounded-sm border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Como você se chama"
        autoFocus
      />

      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">Email</label>
      <input
        className="mb-2 w-full rounded-sm border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@empresa.com"
      />

      {error && <p className="mb-2 text-xs font-medium text-red">{error}</p>}

      <button
        type="submit"
        className="mt-4 w-full rounded-sm bg-green px-4 py-2.5 text-sm font-bold text-black transition hover:bg-green-deep"
      >
        Entrar no workspace
      </button>

      <p className="mt-5 text-center text-xs text-faint">
        Workspace de demonstração com dados de exemplo — tudo editável.
      </p>
    </form>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 text-2xl font-extrabold tracking-[-0.03em]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-black">
        <span className="h-3 w-3 rounded-full bg-green shadow-[0_0_0_3px_#000,0_0_0_4.5px_#00e47c]" />
      </span>
      Nexo
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const db = useDb();
  const ready = useHydrated();
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    hydrate();
  }, []);

  // Já logado? Vai direto para a área logada.
  useEffect(() => {
    if (ready && db.session.user_id) router.replace("/dashboard");
  }, [ready, db.session.user_id, router]);

  // O painel reage ao mouse: spotlight, grade e orbes em parallax (CSS vars).
  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--px", (x * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (y * 2 - 1).toFixed(3));
  };

  const onHeroLeave = () => {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "55%");
    el.style.setProperty("--my", "40%");
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  };

  return (
    <main className="login-page">
      {/* Painel de marca animado — ocupa a maior parte da tela */}
      <section
        className="login-hero"
        aria-hidden
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
      >
        <span className="lh-orb o1" />
        <span className="lh-orb o2" />
        <span className="lh-orb o3" />
        <div className="lh-grid" />
        <div className="lh-spot" />

        <div className="lh-top">
          <span className="lh-mark" />Nexo
        </div>

        <div className="lh-center">
          <h2>O hub que faz os seus eventos <span className="lh-mark-txt">acontecerem</span>.</h2>
          <p>Inscritos, checklist e financeiro de cada evento num só painel — em tempo real.</p>

          {/* preview do produto em vidro — acompanha o mouse em 3D */}
          <div className="lh-preview">
            <div className="lp-head">
              <span className="lp-dot">SM</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lp-title">Summit de Marketing 2026</div>
                <div className="lp-sub">18 jun · São Paulo</div>
              </div>
              <span className="lp-badge">Ativo</span>
            </div>
            <div className="lp-kpis">
              <div className="lp-kpi"><b>312</b><span>inscritos</span></div>
              <div className="lp-kpi"><b>78%</b><span>confirmados</span></div>
              <div className="lp-kpi"><b>64%</b><span>orçamento</span></div>
            </div>
            <div className="lp-bars">
              {[34, 52, 41, 68, 57, 80, 64, 92].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${0.25 + i * 0.07}s` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="lh-foot">Nexo — gestão de eventos sem caos</div>
      </section>

      {/* Login à direita */}
      <section className="login-side">
        <div className="login-brand"><Brand /></div>
        {ready && !db.session.user_id && <LoginForm />}
      </section>
    </main>
  );
}
