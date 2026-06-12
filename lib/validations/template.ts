import { z } from "zod";

// Validação do nome ao salvar o checklist atual como template reutilizável.
export const templateNameSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo"),
});

export type TemplateNameInput = z.infer<typeof templateNameSchema>;
