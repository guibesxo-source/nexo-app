import { z } from "zod";

// Schemas das telas de operação do evento (programação, lotes, segmentos,
// comunicação e cupons) — validados na borda, como manda o padrão do projeto.

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateOnly = z
  .string()
  .min(1, "Informe a data")
  .refine((v) => !Number.isNaN(new Date(v + "T00:00:00").getTime()), "Data inválida");

export const agendaItemSchema = z
  .object({
    title: z.string().trim().min(2, "Dê um título ao bloco").max(120, "Título muito longo"),
    day: dateOnly,
    start: z.string().regex(hhmm, "Hora inválida (HH:MM)"),
    end: z
      .string()
      .trim()
      .default("")
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || hhmm.test(v), "Hora inválida (HH:MM)"),
    speaker: z.string().trim().max(90, "Nome muito longo").default("").transform((v) => v || null),
    location: z.string().trim().max(90, "Local muito longo").default("").transform((v) => v || null),
    kind: z.enum(["abertura", "palestra", "painel", "intervalo", "networking", "encerramento", "outro"]),
    notes: z.string().trim().max(400, "Nota muito longa").default("").transform((v) => v || null),
  })
  .refine((v) => v.end === null || v.end > v.start, {
    path: ["end"],
    message: "Fim antes do início",
  });

export type AgendaItemInput = z.infer<typeof agendaItemSchema>;

export const ticketBatchSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao lote").max(60, "Nome muito longo"),
    price: z.coerce.number().min(0, "Preço não pode ser negativo"),
    quantity: z.coerce.number().int("Use um número inteiro").min(1, "Mínimo de 1 vaga"),
    starts_on: z.string().trim().default("").transform((v) => v || null),
    ends_on: z.string().trim().default("").transform((v) => v || null),
    active: z.boolean().default(true),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, {
    path: ["ends_on"],
    message: "Fim antes do início",
  });

export type TicketBatchInput = z.infer<typeof ticketBatchSchema>;

export const savedSegmentSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao segmento").max(60, "Nome muito longo"),
  status: z.enum(["todos", "pendente", "confirmado", "checkin", "cancelado"]),
  origin: z.enum(["todos", "sympla", "hubspot", "csv", "manual"]),
  q: z.string().trim().max(120).default("").transform((v) => v || null),
  field_key: z.string().trim().default("").transform((v) => v || null),
  field_value: z.string().trim().default("").transform((v) => v || null),
});

export type SavedSegmentInput = z.infer<typeof savedSegmentSchema>;

export const commTemplateSchema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome ao modelo").max(60, "Nome muito longo"),
    channel: z.enum(["email", "whatsapp"]),
    subject: z.string().trim().max(120, "Assunto muito longo").default("").transform((v) => v || null),
    body: z.string().trim().min(5, "Escreva a mensagem").max(4000, "Mensagem muito longa"),
  })
  .refine((v) => v.channel !== "email" || !!v.subject, {
    path: ["subject"],
    message: "E-mail precisa de assunto",
  });

export type CommTemplateInput = z.infer<typeof commTemplateSchema>;

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Informe o código")
      .max(40, "Código muito longo")
      .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
    kind: z.enum(["percent", "fixed", "cortesia"]),
    value: z.coerce.number().min(0, "Valor não pode ser negativo"),
    max_uses: z.coerce
      .number()
      .int("Use um número inteiro")
      .min(1, "Mínimo de 1 uso")
      .nullable()
      .default(null),
    note: z.string().trim().max(160, "Nota muito longa").default("").transform((v) => v || null),
  })
  .refine((v) => v.kind !== "percent" || (v.value > 0 && v.value <= 100), {
    path: ["value"],
    message: "Percentual entre 1 e 100",
  })
  .refine((v) => v.kind !== "fixed" || v.value > 0, {
    path: ["value"],
    message: "Informe o valor do desconto",
  });

export type CouponInput = z.infer<typeof couponSchema>;
