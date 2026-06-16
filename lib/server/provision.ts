// Provisionamento do tenant (server-only): cria profile → workspace →
// membership(owner) → member(owner) e semeia o workspace demo. Usado pelo
// signup e pela rota ensure-workspace (conta antiga sem workspace / timing
// pós-cadastro). Recebe um client com service role (ignora RLS de propósito).

import { type SupabaseClient } from "@supabase/supabase-js";
import { seedState } from "@/lib/db/seed";
import { seedWorkspace } from "@/lib/db/seed-supabase";

export async function provisionWorkspace(
  admin: SupabaseClient,
  userId: string,
  name: string,
  email: string
): Promise<{ error: string | null; workspaceId?: string }> {
  const seed = seedState();
  const workspaceId = globalThis.crypto.randomUUID();

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, full_name: name } as never, { onConflict: "id" });
  if (profileErr) return { error: profileErr.message };

  const { error: wsErr } = await admin.from("workspaces").insert({
    id: workspaceId,
    name: seed.workspace.name,
    timezone: seed.workspace.timezone,
    owner_id: userId,
  } as never);
  if (wsErr) return { error: wsErr.message };

  const { error: memErr } = await admin
    .from("memberships")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" } as never);
  if (memErr) return { error: memErr.message };

  const seedRes = await seedWorkspace(admin, workspaceId, userId, name, email);
  if (seedRes.error) return seedRes;
  return { error: null, workspaceId };
}
