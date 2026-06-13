import { z } from "zod";

// Borda do route handler /api/hubspot — valida o que o client manda antes de
// qualquer chamada à API do HubSpot. O token é um Private App Access Token do
// portal PESSOAL do Nexo (51566439) — nunca o portal da Prolog (44667852).

const token = z.string().trim().min(10, "Token inválido");

export const hubspotRequestSchema = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("forms"), token }),
  z.object({
    resource: z.literal("submissions"),
    token,
    formId: z.string().trim().min(1, "Informe o formulário"),
  }),
]);

export type HubspotRequest = z.infer<typeof hubspotRequestSchema>;
