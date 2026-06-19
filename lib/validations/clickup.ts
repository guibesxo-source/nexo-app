import { z } from "zod";

// Borda do route handler /api/clickup — valida o que o client manda antes de
// chamar a API do ClickUp (api.clickup.com/api/v2). O token é um Personal API
// Token (pk_…) gerado em ClickUp → Settings → Apps. Conta PESSOAL do Nexo.

const token = z.string().trim().min(10, "Token inválido");

export const clickupRequestSchema = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("teams"), token }),
  z.object({ resource: z.literal("spaces"), token, teamId: z.string().trim().min(1, "Informe o time") }),
  z.object({ resource: z.literal("folders"), token, spaceId: z.string().trim().min(1, "Informe o space") }),
  z.object({
    resource: z.literal("lists"),
    token,
    spaceId: z.string().trim().optional(),
    folderId: z.string().trim().optional(),
  }),
  z.object({ resource: z.literal("task"), token, taskId: z.string().trim().min(1, "Informe o projeto") }),
  z.object({ resource: z.literal("tasks"), token, listId: z.string().trim().min(1, "Informe a lista") }),
]);

export type ClickupRequest = z.infer<typeof clickupRequestSchema>;
