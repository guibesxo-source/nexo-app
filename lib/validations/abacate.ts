import { z } from "zod";

// Corpo do POST /api/billing/checkout (vem do seletor da página /planos).
export const checkoutBodySchema = z.object({
  cycle: z.enum(["mensal", "anual"]),
  method: z.enum(["pix", "card"]),
});
export type CheckoutBody = z.infer<typeof checkoutBodySchema>;

// Envelope do webhook v2. Os campos internos variam por evento, então só
// validamos o envelope e lemos o resto defensivamente (normalizeWebhook).
export const webhookEnvelopeSchema = z.object({
  event: z.string().min(1),
  data: z.unknown().optional(),
});
