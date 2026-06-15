"use client";

// Login/cadastro com Supabase Auth (email + senha). No sucesso, espelha a
// identidade na base local (login(name,email)) e entra na área logada.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromUser } from "@/lib/auth";
import { login } from "@/lib/db";

type Mode = "login" | "signup";

function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const n = name.trim();
    const em = email.trim();
    if (mode === "signup" && n.length < 2) return setError("Informe seu nome");
    if (!/^\S+@\S+\.\S+$/.test(em)) return setError("Informe um email válido");
    if (password.length < 6) return setError("A senha precisa de ao menos 6 caracteres");
    if (mode === "signup" && confirm !== password) return setError("As senhas não coincidem");

    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, email: em, password }),
        });
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setError(json?.error ?? "Não consegui criar a conta");
          return;
        }
      }
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: em,
        password,
      });
      if (signErr || !data.user) {
        setError(
          signErr?.message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : signErr?.message ?? "Não consegui entrar"
        );
        return;
      }
      // espelha a sessão na base local (a UI lê de @/lib/db)
      login(displayNameFromUser(data.user), data.user.email ?? em);
      // Navegação "hard" de propósito: com router.replace (transição client) o
      // proxy do Next pode rodar antes do cookie de sessão propagar e devolver
      // pro /login. window.location força uma requisição nova já autenticada.
      if (mode === "signup") {
        // confirma a criação e leva à tela de boas-vindas dentro do app
        setCreated(true);
        setTimeout(() => window.location.replace("/welcome"), 1600);
      } else {
        window.location.replace("/dashboard");
      }
    } catch {
      setError("Falha de conexão — tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-7 text-center shadow-[var(--shadow-md)]">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green text-black">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="text-xl font-extrabold tracking-[-0.03em]">Conta criada com sucesso!</h1>
        <p className="mt-2 text-[13px] text-dim">Bem-vindo ao Nexo — preparando seu workspace…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-7 shadow-[var(--shadow-md)]"
    >
      <h1 className="text-xl font-extrabold tracking-[-0.03em]">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h1>
      <p className="mt-1 mb-6 text-[13px] text-dim">
        {mode === "login"
          ? "Acesse seu workspace com email e senha."
          : "Crie seu acesso — seus dados ficam salvos na sua conta."}
      </p>

      {mode === "signup" && (
        <>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">Seu nome</label>
          <input
            className="mb-4 w-full rounded-sm border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como você se chama"
            autoFocus
          />
        </>
      )}

      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">Email</label>
      <input
        className="mb-4 w-full rounded-sm border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@empresa.com"
        autoFocus={mode === "login"}
      />

      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">Senha</label>
      <input
        className="mb-2 w-full rounded-sm border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === "signup" ? "Crie uma senha (mín. 6)" : "Sua senha"}
      />

      {mode === "signup" && (
        <>
          <label className="mb-1.5 mt-2 block text-[12.5px] font-semibold text-muted">
            Confirmar senha
          </label>
          <input
            className="mb-2 w-full rounded-sm border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
          />
        </>
      )}

      {error && <p className="mb-2 text-xs font-medium text-red">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-sm bg-green px-4 py-2.5 text-sm font-bold text-black transition hover:bg-green-deep disabled:opacity-60"
      >
        {busy ? "Aguarde..." : mode === "login" ? "Entrar no workspace" : "Criar conta e entrar"}
      </button>

      <p className="mt-5 text-center text-xs text-faint">
        {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button
          type="button"
          className="font-semibold text-green-deep hover:underline"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        >
          {mode === "login" ? "Criar conta" : "Entrar"}
        </button>
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
  const heroRef = useRef<HTMLElement>(null);
  const [checking, setChecking] = useState(true);

  // Já autenticado? Vai direto para a área logada (navegação "hard" para o
  // cookie de sessão entrar na requisição da rota protegida pelo proxy).
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (user) window.location.replace("/dashboard");
      else setChecking(false);
    });
    return () => { active = false; };
  }, []);

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
        {!checking && <AuthForm />}
      </section>
    </main>
  );
}
