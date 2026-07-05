import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  ListChecks,
  RadioTower,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SitePricing } from "@/components/site/pricing";
import { HeroFX } from "@/components/site/hero-fx";
import { HeroOrbits, TypewriterHeading } from "@/components/site/hero-orbit";

const dores: { icon: LucideIcon; dor: string; consequencia: string }[] = [
  { icon: Clock, dor: "Horas consolidando informação de várias ferramentas", consequencia: "Tempo que não vira entrega." },
  { icon: TriangleAlert, dor: "Erros financeiros por falta de rastreabilidade central", consequencia: "Estouro de orçamento, prejuízo." },
  { icon: RadioTower, dor: "Equipe desalinhada por falta de visibilidade em tempo real", consequencia: "Tarefas duplicadas, bola fora." },
];

const pilares: { icon: LucideIcon; nome: string; desc: string; destaque?: boolean }[] = [
  { icon: CalendarDays, nome: "Eventos", desc: "Crie e gerencie cada evento — data, local, status e orçamento. Lista com progresso e uma visão geral com os KPIs que importam." },
  { icon: Users, nome: "Inscritos", desc: "Cadastro e importação inteligente (CSV, Sympla, HubSpot). Status pendente → confirmado → check-in, com busca, filtro e export." },
  { icon: ListChecks, nome: "Checklist", desc: "Tarefas por evento com responsável e prazo. Progresso (17/24) e tudo que está atrasado destacado na hora." },
  { icon: Wallet, nome: "Financeiro", desc: "Orçamento e transações por categoria. Gasto vs. orçamento, status de pagamento e anexo de NF — o dinheiro deixa de ser mistério.", destaque: true },
];

const passos = [
  { n: "01", t: "Crie o evento", d: "Nome, data, local e orçamento. Seu hub nasce em segundos." },
  { n: "02", t: "Carregue inscritos e monte o checklist", d: "Importe inscritos e distribua tarefas com prazo e responsável." },
  { n: "03", t: "Opere com o time em tempo real", d: "Lance despesas, marque tarefas, confirme presenças — todos veem a mesma verdade." },
  { n: "04", t: "Encerre com relatório", d: "Check-in no dia, encerre o evento e gere o relatório de resultado." },
];

const personas = [
  { quem: "Produtor independente", frase: "Eu opero sozinho e preciso de controle total sem depender de 10 ferramentas diferentes.", valoriza: "Velocidade, simplicidade e financeiro organizado num só lugar." },
  { quem: "Gestor corporativo", frase: "Organizo eventos internos e preciso justificar cada centavo para a diretoria.", valoriza: "Relatórios claros, rastreabilidade financeira e múltiplos eventos." },
];

const comparativo = [
  ["Planilha + doc + WhatsApp + pasta de NF", "Um hub único por evento"],
  ["Cada um com sua versão da verdade", "Tempo real para todo o time"],
  ["Dinheiro espalhado e esquecido", "Financeiro nativo por evento"],
  ["Ferramenta horizontal genérica", "Vertical: feito para eventos"],
  ["Sem visão de múltiplos eventos", "Lista e consolidação de eventos"],
];

const marqueeItems = [
  "Beta aberto — grátis por tempo indeterminado",
  "Sem cartão de crédito",
  "Construído com o feedback de quem usa",
  "Substitui 6+ ferramentas",
  "Financeiro nativo por evento",
  "Tempo real para o time",
];

export default function SiteHome() {
  return (
    <>
      {/* 1 · HERO */}
      <section className="hero">
        <HeroFX />
        <div className="mx-auto grid max-w-[var(--site-max)] items-center gap-12 px-6 pb-16 pt-16 sm:pt-24 lg:grid-cols-2 lg:gap-6">
          {/* coluna esquerda — copy */}
          <div className="text-center lg:text-left">
            <div className="reveal flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <span className="eyebrow text-green">Back-office do evento</span>
              <span className="hero-free">R$ 0 — grátis por tempo indeterminado</span>
            </div>

            <TypewriterHeading />

            <p
              className="reveal mx-auto mt-6 max-w-[46ch] text-[17px] leading-relaxed text-white/65 lg:mx-0"
              style={{ animationDelay: "0.12s" }}
            >
              Inscritos, checklist e financeiro do seu evento num só lugar — em tempo real, sem
              planilha.
            </p>

            <div
              className="reveal mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
              style={{ animationDelay: "1.9s" }}
            >
              <span className="btn-spin">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-green px-6 py-3.5 text-sm font-bold text-black transition hover:bg-green-deep"
                >
                  Começar grátis <ArrowRight className="h-4 w-4" />
                </Link>
              </span>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/50"
              >
                Ver como funciona
              </a>
            </div>

            <p className="reveal mt-6 text-[12.5px] text-white/45" style={{ animationDelay: "2.2s" }}>
              Grátis no beta, por tempo indeterminado · sem cartão · cancele quando quiser
            </p>
          </div>

          {/* coluna direita — módulos orbitando o hub */}
          <div className="reveal" style={{ animationDelay: "0.3s" }}>
            <HeroOrbits />
          </div>
        </div>
      </section>

      {/* 2 · MARQUEE */}
      <div className="marquee">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((m, i) => (
            <span key={i}>
              <i>✦</i>&nbsp;&nbsp;{m}
            </span>
          ))}
        </div>
      </div>

      {/* 3 · PROBLEMA */}
      <section className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="max-w-2xl">
          <span className="eyebrow text-green-deep">O caos da fragmentação</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Informação espalhada vira <span className="mark-pill">prejuízo</span>.
          </h2>
          <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
            Nota fiscal numa pasta. Checklist num doc. Inscritos numa planilha. Custos num grupo de
            WhatsApp. Retrabalho vira erro, erro vira prejuízo.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {dores.map(({ icon: Icon, dor, consequencia }) => (
            <div key={dor} className="rounded-lg border border-black/10 bg-white p-6 shadow-[var(--shadow-sm)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-ink text-green">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-[15px] font-bold leading-snug tracking-[-0.01em]">{dor}</p>
              <p className="mt-2 text-[13.5px] text-dim">{consequencia}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · PILARES */}
      <section id="funcionalidades" className="border-y border-black/8 bg-[#fafaf8]">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24">
          <div className="max-w-2xl">
            <span className="eyebrow text-green-deep">Um hub, não mais um app</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Tudo do seu evento <span className="mark-pill">num só lugar</span>.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {pilares.map(({ icon: Icon, nome, desc, destaque }) => (
              <div
                key={nome}
                className={`rounded-lg border p-7 transition ${
                  destaque
                    ? "border-green/40 bg-ink text-white shadow-[var(--shadow-lg)]"
                    : "border-black/10 bg-white shadow-[var(--shadow-sm)]"
                }`}
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-[12px] ${
                    destaque ? "bg-green text-black" : "bg-green-soft text-green-deep"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-2 text-[19px] font-extrabold tracking-[-0.02em]">
                  {nome}
                  {destaque && (
                    <span className="rounded-full bg-green px-2 py-0.5 text-[10px] font-bold text-black">
                      o diferencial
                    </span>
                  )}
                </h3>
                <p className={`mt-2 text-[14px] leading-relaxed ${destaque ? "text-white/70" : "text-muted"}`}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · COMO FUNCIONA */}
      <section id="como-funciona" className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="max-w-2xl">
          <span className="eyebrow text-green-deep">Do lançamento ao pós-evento</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Como funciona
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
          {passos.map((p) => (
            <div key={p.n} className="bg-white p-6">
              <div className="text-[13px] font-extrabold text-green-deep">{p.n}</div>
              <h3 className="mt-3 text-[16px] font-bold leading-snug tracking-[-0.01em]">{p.t}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-dim">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 · PARA QUEM É / SOBRE */}
      <section id="sobre" className="border-y border-black/8 bg-[#fafaf8]">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24">
          <div className="max-w-2xl">
            <span className="eyebrow text-green-deep">Nascido da dor real</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Feito para quem <span className="mark-pill">opera</span> eventos.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
              O Nexo nasce da rotina de quem gerencia vários eventos ao mesmo tempo — online e
              presenciais. Não é ticketing, não é CRM, não é um PM genérico. É o back-office do evento.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {personas.map((p) => (
              <div key={p.quem} className="rounded-lg border border-black/10 bg-white p-7 shadow-[var(--shadow-sm)]">
                <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-green-deep">
                  {p.quem}
                </div>
                <p className="mt-3 text-[18px] font-bold leading-snug tracking-[-0.02em]">
                  “{p.frase}”
                </p>
                <p className="mt-3 text-[13.5px] text-dim">{p.valoriza}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · POR QUE NÃO PLANILHA */}
      <section className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="max-w-2xl">
          <span className="eyebrow text-green-deep">Por que não resolver com planilha</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Planilha não é hub.
          </h2>
        </div>
        <div className="mt-10 overflow-hidden rounded-lg border border-black/10">
          <div className="grid grid-cols-2 bg-ink text-[12px] font-bold uppercase tracking-[0.08em] text-white">
            <div className="px-5 py-3 text-white/55">Status quo</div>
            <div className="px-5 py-3">Com o Nexo</div>
          </div>
          {comparativo.map(([antes, depois], i) => (
            <div key={i} className={`grid grid-cols-2 ${i % 2 ? "bg-[#fafaf8]" : "bg-white"}`}>
              <div className="px-5 py-4 text-[14px] text-dim line-through decoration-black/20">{antes}</div>
              <div className="flex items-start gap-2 px-5 py-4 text-[14px] font-semibold text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-deep" />
                {depois}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8 · PREÇOS */}
      <section id="precos" className="border-y border-black/8 bg-[#fafaf8]">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow text-green-deep">Beta aberto</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Grátis <span className="mark-pill">por enquanto</span>. De verdade.
            </h2>
            <p className="mt-4 text-[16px] text-muted">
              O Nexo está em beta: acesso completo, de graça, por tempo indeterminado. Em troca,
              queremos seu feedback — os valores abaixo são a referência para quando o produto
              estiver maduro.
            </p>
          </div>

          <SitePricing />
        </div>
      </section>

      {/* 9 · CTA FINAL */}
      <section className="bg-[#050505] text-white">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 text-center">
          <h2 className="mx-auto max-w-[18ch] text-[clamp(30px,5vw,56px)] font-extrabold leading-[1.06] tracking-[-0.035em]">
            Saia do caos. Comece pelo seu <span className="mark-pill">próximo evento</span>.
          </h2>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-sm bg-green px-5 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
            >
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#precos"
              className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:border-white/50"
            >
              Ver preços
            </a>
          </div>
          <p className="mt-5 text-[12.5px] text-white/45">Grátis no beta · sem cartão · cancele quando quiser</p>
        </div>
      </section>
    </>
  );
}
