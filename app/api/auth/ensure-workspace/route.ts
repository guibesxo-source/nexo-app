import { NextResponse } from "next/server";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase/server";
import { displayNameFromUser } from "@/lib/auth";
import { provisionWorkspace } from "@/lib/server/provision";

// Garante que o usuário autenticado tenha um workspace. Cobre contas antigas
// (criadas antes do provisionamento) e o timing logo após o signup. Idempotente:
// se já existe membership, não faz nada.

export async function POST() {
  const server = await createServer();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: mem } = await admin
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (mem) return NextResponse.json({ ok: true, existing: true });

  const res = await provisionWorkspace(
    admin as SupabaseClient,
    user.id,
    displayNameFromUser(user),
    user.email ?? ""
  );
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
