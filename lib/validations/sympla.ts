import { z } from "zod";

// Borda do route handler /api/sympla — valida o que o client manda
// antes de qualquer chamada à API pública do Sympla.

const token = z.string().trim().min(8, "Token inválido");

export const symplaRequestSchema = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("events"), token }),
  z.object({
    resource: z.literal("participants"),
    token,
    eventId: z.string().trim().min(1, "Informe o evento"),
  }),
  z.object({
    resource: z.literal("orders"),
    token,
    eventId: z.string().trim().min(1, "Informe o evento"),
  }),
]);

export type SymplaRequest = z.infer<typeof symplaRequestSchema>;
