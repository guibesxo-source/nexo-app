import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { provisionWorkspace } from "@/lib/server/provision";

// Cadastro via service role com o usuário JÁ CONFIRMADO (email_confirm), pra
// não depender de email de confirmação no MVP. Ao abrir multiusuário, trocar
// por fluxo com confirmação/convite e travar signup aberto.
//
// Além de criar o usuário, provisiona o tenant (profile → workspace →
// membership(owner) → seed demo). Se o provisionamento falhar, desfaz o
// usuário para o cadastro poder ser repetido.

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

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error || !created.user) {
    const msg = error?.message ?? "Não consegui criar a conta";
    const dup = /already|registered|exists|duplicate/i.test(msg);
    return NextResponse.json(
      { error: dup ? "Esse email já tem conta — faça login." : msg },
      { status: dup ? 409 : 400 }
    );
  }

  const userId = created.user.id;
  const provision = await provisionWorkspace(admin, userId, name, email);
  if (provision.error) {
    // limpa o usuário órfão para o cadastro poder ser refeito
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json(
      { error: "Não consegui preparar seu workspace. Tente de novo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
