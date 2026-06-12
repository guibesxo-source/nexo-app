import { z } from "zod";

const isoDate = z
  .string()
  .min(1, "Informe a data")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Data inválida");

export const eventSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  starts_at: isoDate,
  location: z.string().trim().min(1, "Informe o local"),
  capacity: z.coerce.number().int("Use um número inteiro").min(1, "Meta mínima de 1"),
  budget_planned: z.coerce.number().min(0, "Orçamento não pode ser negativo"),
  status: z.enum(["rascunho", "planejamento", "confirmado", "encerrado", "cancelado"]),
  cover: z.string().trim().min(1, "Escolha uma capa").optional(),
  format: z.enum(["online", "presencial", "hibrido"]).optional(),
  priority: z.enum(["alta", "media", "baixa"]).optional(),
});

export type EventInput = z.infer<typeof eventSchema>;
