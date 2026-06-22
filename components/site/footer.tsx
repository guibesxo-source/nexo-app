import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#050505] text-white">
      <div className="mx-auto max-w-[var(--site-max)] px-6 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <div className="wordmark inv">
              <span className="mark" aria-hidden />
              Nexo
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/55">
              O hub que faz os seus eventos acontecerem. Inscritos, checklist e financeiro num só
              painel, em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                Produto
              </div>
              <ul className="mt-3 space-y-2 text-[13.5px] text-white/70">
                <li><a href="#funcionalidades" className="hover:text-green">Funcionalidades</a></li>
                <li><a href="#como-funciona" className="hover:text-green">Como funciona</a></li>
                <li><a href="#precos" className="hover:text-green">Preços</a></li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                Conta
              </div>
              <ul className="mt-3 space-y-2 text-[13.5px] text-white/70">
                <li><Link href="/login" className="hover:text-green">Entrar</Link></li>
                <li><Link href="/login" className="hover:text-green">Começar grátis</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                Contato
              </div>
              <ul className="mt-3 space-y-2 text-[13.5px] text-white/70">
                <li><a href="mailto:guibesxo@gmail.com" className="hover:text-green">guibesxo@gmail.com</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-[12px] text-white/40 sm:flex-row sm:items-center">
          <span>© {year} Nexo. Feito para quem organiza eventos.</span>
          <span>Somente web por enquanto · app mobile em breve</span>
        </div>
      </div>
    </footer>
  );
}
