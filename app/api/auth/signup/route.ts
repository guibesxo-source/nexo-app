import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Cadastro via service role com o usuário JÁ CONFIRMADO (email_confirm), pra
// não depender de email de confirmação no MVP. Ao abrir multiusuário, trocar
// por fluxo com confirmação/convite e travar signup aberto.

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha precisa de ao menos 6 caracteres").max(72),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error) {
    const dup = /already|registered|exists|duplicate/i.test(error.message);
    return NextResponse.json(
      { error: dup ? "Esse email já tem conta — faça login." : error.message },
      { status: dup ? 409 : 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
