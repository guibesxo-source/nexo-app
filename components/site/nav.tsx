import Link from "next/link";

const LINKS = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#sobre", label: "Sobre" },
];

export function SiteNav() {
  return (
    <header className="site-nav">
      <nav className="mx-auto flex h-[68px] max-w-[var(--site-max)] items-center justify-between px-6">
        <Link href="/" className="wordmark" aria-label="Nexo — início">
          <span className="mark" aria-hidden />
          Nexo
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13.5px] font-semibold text-muted transition hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden rounded-sm px-3.5 py-2 text-[13.5px] font-semibold text-ink transition hover:bg-black/5 sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/login"
            className="rounded-sm bg-green px-4 py-2 text-[13.5px] font-bold text-black transition hover:bg-green-deep"
          >
            Começar grátis
          </Link>
        </div>
      </nav>
    </header>
  );
}
