import { z } from "zod";

// Schemas de autenticação — usados nos formulários (client) e nos handlers
// (server). Mensagens em português, alinhadas com o restante da UI.

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail")
  .email("Informe um e-mail válido");

export const passwordSchema = z
  .string()
  .min(6, "A senha precisa de ao menos 6 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha"),
});

// Payload aceito pelo handler POST /api/auth/signup.
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(80, "Nome muito longo"),
  email: emailSchema,
  password: passwordSchema,
});

// Formulário de cadastro (client): inclui a confirmação de senha.
export const signupFormSchema = signupSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.confirm === v.password, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

// Solicitação de reset de senha.
export const requestResetSchema = z.object({ email: emailSchema });

// Redefinição de senha (página acessada pelo link do e-mail).
export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.confirm === v.password, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

/** Primeira mensagem de erro de um parse Zod que falhou. */
export function firstIssue(error: z.ZodError, fallback = "Dados inválidos"): string {
  return error.issues[0]?.message ?? fallback;
}
