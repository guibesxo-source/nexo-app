import { z } from "zod";

export const attendeeSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  email: z.email("Email inválido"),
  company: z.string().trim().max(120, "Empresa muito longa").default(""),
  ticket: z.enum(["Geral", "Pro", "VIP"]),
  status: z.enum(["pendente", "confirmado", "checkin", "cancelado"]),
});

export type AttendeeInput = z.infer<typeof attendeeSchema>;
