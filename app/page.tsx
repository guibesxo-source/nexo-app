import Link from "next/link";

// Home provisória — smoke test visual dos tokens da marca.
// A LP pública continua no repo do protótipo (guibesxo-source/nexo) até a migração.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-ink px-6 py-24 text-white">
      <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-green-deep">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
        Beta privado em construção
      </span>

      <h1 className="max-w-3xl text-center text-5xl font-extrabold tracking-[-0.035em] sm:text-6xl">
        O hub que faz os seus eventos{" "}
        <span className="inline-block -rotate-1 rounded-full bg-green px-4 py-1 text-black">
          acontecerem
        </span>
      </h1>

      <p className="mt-6 max-w-xl text-center text-lg leading-relaxed text-muted-inv">
        Financeiro, checklist e inscritos num só painel, em tempo real.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-md bg-green px-6 py-3 font-bold text-black transition hover:-translate-y-0.5 hover:bg-green-deep"
        >
          Abrir o app (demo)
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-white/30 px-6 py-3 font-semibold text-white transition hover:border-white"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
