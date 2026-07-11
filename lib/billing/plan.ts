// Apresentação do plano Fundador (copy + preço) e o mapa de ciclos × métodos.
// O preço REAL é cobrado pelo PRODUTO na AbacatePay — mantenha em sincronia.
//
// Estrutura (ver vault "Nexo - Estrutura de Precos"):
//   • Beta: só Fundador, escolhível em Mensal (R$ 49/mês, cartão) ou
//     Anual (R$ 588 = R$ 49/mês, PIX ou cartão, com lock vitalício).
//   • Pós-beta (GA): Pro Mensal R$ 89 e Pro Anual R$ 69 (fundadores ficam em R$ 49).
//   • "R$ 89/mês" entra como ÂNCORA pública para sustentar a urgência do beta.

export type Cycle = "mensal" | "anual";
export type Method = "pix" | "card";

type CycleInfo = {
  label: string;
  priceLabel: string;
  period: string;
  note: string;
  methodsBadge: string;
  methods: Method[];
  /** Benefícios exibidos no card do site (o checkout usa só ciclo × método). */
  features: string[];
};

export const FOUNDER_PLAN = {
  name: "Fundador",
  publicMonthly: "R$ 89/mês",
  lockLine:
    "Depois do beta, o preço público é R$ 89/mês. Como fundador, você trava R$ 49/mês para sempre.",
  tagline:
    "Vagas limitadas. O preço de fundador não aumenta enquanto a assinatura seguir ativa.",
  features: [
    "Eventos ilimitados",
    "Inscritos com importação inteligente (CSV, Sympla, HubSpot)",
    "Checklist por evento com prazos e responsáveis",
    "Financeiro nativo por evento — orçamento, categorias e NF",
    "Integrações ao vivo: Sympla, HubSpot e ClickUp",
    "Preço de fundador travado para sempre",
  ],
  cycles: {
    anual: {
      label: "Anual",
      priceLabel: "R$ 588",
      period: "/ano",
      note: "equivale a R$ 49/mês — pago uma vez no ano",
      methodsBadge: "PIX ou cartão",
      methods: ["pix", "card"],
      features: [
        "R$ 49/mês pagos uma vez no ano",
        "PIX à vista ou cartão (renova no ano)",
        "Preço de fundador travado para sempre",
        "Eventos e equipe ilimitados",
        "Integrações ao vivo: Sympla, HubSpot e ClickUp",
        "Financeiro nativo — orçamento, categorias e NF",
      ],
    },
    mensal: {
      label: "Mensal",
      priceLabel: "R$ 49",
      period: "/mês",
      note: "cobrado todo mês no cartão",
      methodsBadge: "Cartão",
      methods: ["card"],
      features: [
        "Renova todo mês — cancele quando quiser",
        "Preço de fundador travado enquanto assinar",
        "Eventos e equipe ilimitados",
        "Integrações ao vivo: Sympla, HubSpot e ClickUp",
        "Financeiro nativo — orçamento, categorias e NF",
        "Crachás, segmentos e comunicação de inscritos",
      ],
    },
  } satisfies Record<Cycle, CycleInfo>,
} as const;

/**
 * Oferta vigente: BETA GRATUITO por tempo indeterminado (ADR-004 no vault,
 * 2026-07-04). Nada é cobrado; o produto amadurece com o feedback de quem usa
 * e só então a Estrutura de Preços entra em vigor. O FOUNDER_PLAN acima fica
 * dormente junto com o checkout (flag FREE_BETA em lib/billing/entitlement).
 */
export const FREE_BETA_OFFER = {
  tag: "Beta aberto",
  priceLabel: "R$ 0",
  period: "por enquanto",
  note: "grátis por tempo indeterminado · sem cartão de crédito",
  features: [
    "Eventos ilimitados",
    "Inscritos com importação inteligente (CSV, Sympla, HubSpot)",
    "Checklist por evento com prazos e responsáveis",
    "Financeiro nativo por evento — orçamento, categorias e NF",
    "Integrações ao vivo: Sympla, HubSpot e ClickUp",
    "Crachás, segmentos e comunicação de inscritos",
    "Dashboard com insights em tempo real",
    "Acesso completo — nada bloqueado no beta",
  ],
  feedbackLine:
    "O beta é gratuito porque o Nexo está sendo construído com quem usa. Em troca, queremos o seu feedback — e você será avisado com antecedência antes de qualquer cobrança.",
  cta: "Começar grátis",
  tagline: "Sem cartão · leva menos de 1 minuto pra criar a conta",
} as const;

/**
 * Escada de preços definida no vault ("Nexo - Estrutura de Precos" §3) —
 * exibida no site LADO A LADO como REFERÊNCIA do futuro, sem venda. Quando o
 * produto amadurecer, estes planos ganham produto na AbacatePay e o checkout
 * reativa.
 */
export const GA_PLANS = [
  {
    id: "pro-mensal",
    name: "Pro Mensal",
    priceLabel: "R$ 89",
    period: "/mês",
    note: "entrada sem compromisso anual",
    features: [
      "O produto completo, sem limites",
      "Eventos e equipe ilimitados",
      "Todas as integrações ao vivo",
    ],
    availability: "Preço futuro — hoje o Nexo é grátis",
  },
  {
    id: "pro-anual",
    name: "Pro Anual",
    priceLabel: "R$ 69",
    period: "/mês",
    note: "R$ 828/ano — pago uma vez (~22% off o mensal)",
    features: [
      "O produto completo, sem limites",
      "Eventos e equipe ilimitados",
      "2,5 meses grátis vs. o mensal",
    ],
    availability: "Preço futuro — hoje o Nexo é grátis",
  },
] as const;

export type GaPlan = (typeof GA_PLANS)[number];

/** Rótulo do botão de pagamento por ciclo × método. */
export function payLabel(cycle: Cycle, method: Method): string {
  if (method === "pix") return "Pagar com PIX (à vista)";
  return cycle === "mensal"
    ? "Assinar no cartão (renova todo mês)"
    : "Assinar no cartão (renova todo ano)";
}
