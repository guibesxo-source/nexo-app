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
    },
    mensal: {
      label: "Mensal",
      priceLabel: "R$ 49",
      period: "/mês",
      note: "cobrado todo mês no cartão",
      methodsBadge: "Cartão",
      methods: ["card"],
    },
  } satisfies Record<Cycle, CycleInfo>,
} as const;

/** Rótulo do botão de pagamento por ciclo × método. */
export function payLabel(cycle: Cycle, method: Method): string {
  if (method === "pix") return "Pagar com PIX (à vista)";
  return cycle === "mensal"
    ? "Assinar no cartão (renova todo mês)"
    : "Assinar no cartão (renova todo ano)";
}
