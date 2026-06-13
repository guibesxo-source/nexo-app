import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Título muito curto").max(160, "Título muito longo"),
  group: z.string().trim().min(1, "Informe o grupo"),
  phase: z.enum(["pre", "durante", "pos"]).default("pre"),
  assignee_id: z.string().nullable().default(null),
  due_date: z
    .string()
    .nullable()
    .default(null)
    .refine((v) => v === null || v === "" || !Number.isNaN(new Date(v).getTime()), "Data inválida")
    .transform((v) => (v === "" ? null : v)),
});

export type TaskInput = z.infer<typeof taskSchema>;
