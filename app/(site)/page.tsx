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

/* Copy orientada a conversão: cada seção responde uma pergunta do visitante,
   na ordem em que ele pergunta — O que é? → Dói onde? → O que eu ganho? →
   Como funciona? → É pra mim? → Por que não planilha? → Quanto custa? →
   E as minhas dúvidas? → CTA. Prova social honesta: beta + fundador-operador
   (sem depoimento inventado). */

const dores: { icon: LucideIcon; dor: string; consequencia: string }[] = [
  {
    icon: Clock,
    dor: "Toda segunda você reconstrói o status do evento na mão",
    consequencia: "Horas cruzando planilha, doc e WhatsApp — tempo que não vira entrega.",
  },
  {
    icon: TriangleAlert,
    dor: "Despesa lançada em três lugares (ou em nenhum)",
    consequencia: "Você só descobre o estouro de orçamento quando a fatura chega.",
  },
  {
    icon: RadioTower,
    dor: "Cada pessoa do time com uma versão da verdade",
    consequencia: "Tarefa duplicada, tarefa esquecida — e a bola fora aparece no dia do evento.",
  },
];

const pilares: { icon: LucideIcon; nome: string; desc: string; destaque?: boolean }[] = [
  {
    icon: CalendarDays,
    nome: "Eventos",
    desc: "Um hub por evento — data, local, status e orçamento. Abra a lista e saiba em segundos qual evento precisa de você hoje.",
  },
  {
    icon: Users,
    nome: "Inscritos",
    desc: "Importe de CSV, Sympla ou HubSpot e pare de retrabalhar lista. Pendente → confirmado → check-in, com busca, filtro e export.",
  },
  {
    icon: ListChecks,
    nome: "Checklist",
    desc: "Cada tarefa com dono e prazo. O progresso (17/24) e o que está atrasado aparecem sozinhos — ninguém precisa cobrar status.",
  },
  {
    icon: Wallet,
    nome: "Financeiro",
    desc: "Gasto vs. orçamento em tempo real, transação por categoria, status de pagamento e NF anexada. Você sabe quanto o evento custou antes de ele acabar.",
    destaque: true,
  },
];

const passos = [
  { n: "01", t: "Crie o evento", d: "Nome, data, local e orçamento. Seu hub nasce em menos de um minuto." },
  { n: "02", t: "Carregue inscritos e monte o checklist", d: "Importe a lista que você já tem e distribua tarefas com prazo e responsável." },
  { n: "03", t: "Opere com o time em tempo real", d: "Lance despesas, marque tarefas, confirme presenças — todos veem a mesma verdade." },
  { n: "04", t: "Encerre com relatório", d: "Check-in no dia, encerre o evento e saia com o resultado consolidado." },
];

const personas = [
  {
    quem: "Produtor independente",
    frase: "Eu opero sozinho e preciso de controle total sem depender de 10 ferramentas diferentes.",
    valoriza: "Velocidade, simplicidade e o financeiro organizado num só lugar — sem montar sistema.",
  },
  {
    quem: "Gestor corporativo",
    frase: "Organizo eventos internos e preciso justificar cada centavo para a diretoria.",
    valoriza: "Rastreabilidade financeira, visão de múltiplos eventos e relatório pronto no encerramento.",
  },
];

const comparativo = [
  ["Planilha + doc + WhatsApp + pasta de NF", "Um hub único por evento"],
  ["Cada um com sua versão da verdade", "Tempo real para todo o time"],
  ["Dinheiro espalhado e esquecido", "Financeiro nativo por evento"],
  ["Ferramenta horizontal genérica", "Vertical: feito para eventos"],
  ["Sem visão de múltiplos eventos", "Lista e consolidação de eventos"],
];

const faq: { q: string; a: string }[] = [
  {
    q: "É grátis mesmo? Qual é a pegadinha?",
    a: "É grátis: o Nexo está em beta aberto com acesso completo, por tempo indeterminado. A troca é honesta — queremos seu feedback para construir o produto certo. Quem quiser pode travar o preço de fundador (R$ 49/mês para sempre), mas pagar é opcional enquanto o beta durar.",
  },
  {
    q: "Preciso de cartão de crédito para começar?",
    a: "Não. Você cria a conta, cria o evento e opera. Nenhum dado de pagamento é pedido no beta.",
  },
  {
    q: "O Nexo substitui o quê, exatamente?",
    a: "A planilha de inscritos, o doc de checklist, a planilha de custos, a pasta de notas fiscais e as mensagens de \"como está o evento?\" no WhatsApp. Ele não é ticketing, não é CRM e não é disparo de e-mail — é o back-office que amarra tudo isso.",
  },
  {
    q: "Funciona para eventos online e presenciais?",
    a: "Sim. O Nexo nasceu operando os dois: webinars e lives têm inscritos, checklist e custos do mesmo jeito que um evento com palco — muda o check-in, não a gestão.",
  },
  {
    q: "Sou só eu na operação. Faz sentido?",
    a: "É o caso de origem. O Nexo foi desenhado primeiro para quem opera sozinho — o time entra depois, quando (e se) você precisar, sem custo extra no beta.",
  },
  {
    q: "E quando o beta acabar? E os meus dados?",
    a: "Você será avisado com antecedência, quem travou fundador segue em R$ 49/mês, e os dados são seus: inscritos e financeiro exportam em CSV a qualquer momento.",
  },
];

const substituidos = [
  "planilha de inscritos",
  "doc de checklist",
  "planilha de custos",
  "pasta de notas fiscais",
  "grupo de status no WhatsApp",
];

export default function SiteHome() {
  return (
    <>
      {/* 1 · HERO — outcome + para quem + produto visível */}
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
              Feito para quem produz eventos: inscritos, checklist e financeiro num painel só,
              em tempo real — sem planilha, sem doc, sem &ldquo;alguém sabe quanto já gastamos?&rdquo;.
            </p>

            <div
              className="reveal mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
              style={{ animationDelay: "0.24s" }}
            >
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-green px-6 py-3.5 text-sm font-bold text-black transition hover:bg-green-deep"
              >
                Criar meu primeiro evento <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/50"
              >
                Ver como funciona
              </a>
            </div>

            <p className="reveal mt-6 text-[12.5px] text-white/45" style={{ animationDelay: "0.36s" }}>
              Grátis no beta · sem cartão · seu hub pronto em 2 minutos
            </p>
          </div>

          {/* coluna direita — módulos orbitando o hub */}
          <div className="reveal" style={{ animationDelay: "0.3s" }}>
            <HeroOrbits />
          </div>
        </div>
      </section>

      {/* 2 · O QUE O NEXO SUBSTITUI — barra estática, informativa */}
      <div className="replaces">
        <div className="replaces-row">
          <span className="replaces-label">Aposente</span>
          {substituidos.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>

      {/* 3 · PROBLEMA — agitar a dor com cenas reconhecíveis, não categorias */}
      <section className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="max-w-2xl">
          <span className="eyebrow text-green-deep">O caos da fragmentação</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Informação espalhada vira <span className="mark-pill">prejuízo</span>.
          </h2>
          <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
            Nota fiscal numa pasta. Checklist num doc. Inscritos numa planilha. Custos num grupo de
            WhatsApp. Cada ida e volta entre ferramentas é uma chance de erro — e erro em evento
            custa dinheiro e reputação.
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

      {/* 4 · PILARES / SOLUÇÃO */}
      <section id="funcionalidades" className="border-y border-black/8 bg-[#f2f2ec]">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24">
          <div className="max-w-2xl">
            <span className="eyebrow text-green-deep">Um hub, não mais um app</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Tudo do seu evento <span className="mark-pill">num só lugar</span>.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
              Quatro módulos que conversam entre si — o que você lança num aparece no outro, e o
              time inteiro enxerga a mesma coisa.
            </p>
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

      {/* 5 · COMO FUNCIONA — sequência real, com CTA no fim do caminho */}
      <section id="como-funciona" className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="max-w-2xl">
          <span className="eyebrow text-green-deep">Do lançamento ao pós-evento</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Do zero ao relatório em 4 passos
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
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-green px-5 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
          >
            Começar pelo passo 01 <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-[13px] text-dim">Grátis no beta · sem cartão</span>
        </div>
      </section>

      {/* 6 · PARA QUEM É + PROVA HONESTA (fundador-operador) */}
      <section id="sobre" className="border-y border-black/8 bg-[#f2f2ec]">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24">
          <div className="max-w-2xl">
            <span className="eyebrow text-green-deep">Nascido da dor real</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Feito para quem <span className="mark-pill">opera</span> eventos.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
              O Nexo não saiu de um brainstorm: saiu da rotina de quem gerencia vários eventos ao
              mesmo tempo — online e presenciais — e cansou de operar no meio de planilhas. Não é
              ticketing, não é CRM, não é um PM genérico. É o back-office do evento.
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

          {/* nota do fundador — prova social honesta de beta */}
          <div className="mt-5 rounded-lg border border-green/30 bg-ink p-7 text-white shadow-[var(--shadow-lg)] md:p-9">
            <div className="eyebrow text-green">Quem constrói também opera</div>
            <p className="mt-4 max-w-[62ch] text-[17px] font-semibold leading-relaxed tracking-[-0.01em] text-white/90">
              “Eu produzo eventos online e presenciais toda semana. O Nexo é a ferramenta que eu
              procurei e não existia — cada tela nasce de um problema que eu tive num evento de
              verdade, e é por isso que o beta é grátis: quero que ele resolva o seu também.”
            </p>
            <p className="mt-4 text-[13px] font-bold text-white/55">
              Guilherme Bessa · fundador do Nexo, produtor de eventos
            </p>
          </div>
        </div>
      </section>

      {/* 7 · POR QUE NÃO PLANILHA — objeção nº 1 respondida de frente */}
      <section className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="max-w-2xl">
          <span className="eyebrow text-green-deep">Por que não resolver com planilha</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Planilha não é hub.
          </h2>
          <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
            A planilha funciona até o segundo evento simultâneo. Depois disso, ela vira o problema.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-lg border border-black/10">
          <div className="grid grid-cols-2 bg-ink text-[12px] font-bold uppercase tracking-[0.08em] text-white">
            <div className="px-5 py-3 text-white/55">Status quo</div>
            <div className="px-5 py-3">Com o Nexo</div>
          </div>
          {comparativo.map(([antes, depois], i) => (
            <div key={i} className={`grid grid-cols-2 ${i % 2 ? "bg-[#f2f2ec]" : "bg-white"}`}>
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
      <section id="precos" className="border-y border-black/8 bg-[#f2f2ec]">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow text-green-deep">Beta aberto</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Grátis <span className="mark-pill">por enquanto</span>. De verdade.
            </h2>
            <p className="mt-4 text-[16px] text-muted">
              Acesso completo, de graça, por tempo indeterminado — em troca do seu feedback. Os
              valores ao lado são os preços reais de fundador, para quem quiser travar desde já.
            </p>
          </div>

          <SitePricing />
        </div>
      </section>

      {/* 9 · FAQ — objeções restantes, respondidas antes do CTA final */}
      <section id="faq" className="mx-auto max-w-[var(--site-max)] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="eyebrow justify-center text-green-deep">Antes de você decidir</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
              Perguntas diretas, respostas diretas
            </h2>
          </div>
          <div className="mt-10 grid gap-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="faq-item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10 · CTA FINAL */}
      <section className="bg-[#050505] text-white">
        <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 text-center">
          <h2 className="mx-auto max-w-[18ch] text-[clamp(30px,5vw,56px)] font-extrabold leading-[1.06] tracking-[-0.035em]">
            Saia do caos. Comece pelo seu <span className="mark-pill">próximo evento</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
            Crie a conta, importe seus inscritos e veja o financeiro do evento inteiro numa tela —
            hoje, de graça.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-sm bg-green px-5 py-3 text-sm font-bold text-black transition hover:bg-green-deep"
            >
              Criar meu primeiro evento <ArrowRight className="h-4 w-4" />
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
