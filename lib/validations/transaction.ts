import { z } from "zod";

export const transactionSchema = z.object({
  description: z.string().trim().min(2, "Descreva o lançamento").max(160, "Descrição muito longa"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  kind: z.enum(["entrada", "saida"]),
  category_id: z.string().nullable().default(null),
  payment_status: z.enum(["pago", "pendente", "recebido"]),
  invoice_ref: z
    .string()
    .trim()
    .default("")
    .transform((v) => (v === "" ? null : v)),
  invoice_file: z
    .object({ name: z.string().min(1), data: z.string().min(1) })
    .nullable()
    .default(null),
  boleto_file: z
    .object({ name: z.string().min(1), data: z.string().min(1) })
    .nullable()
    .default(null),
  occurred_on: z
    .string()
    .min(1, "Informe a data")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Data inválida"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
