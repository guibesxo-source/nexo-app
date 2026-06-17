import { z } from "zod";

export const attendeeSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  email: z.email("Email inválido"),
  company: z.string().trim().max(120, "Empresa muito longa").default(""),
  // Texto livre: mantém o nome real do ingresso da origem (Sympla/CSV).
  ticket: z.string().trim().min(1, "Informe o ingresso").max(80, "Ingresso muito longo").default("Geral"),
  status: z.enum(["pendente", "confirmado", "checkin", "cancelado"]),
});

export type AttendeeInput = z.infer<typeof attendeeSchema>;
