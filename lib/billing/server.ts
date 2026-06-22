import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "./entitlement";

// Leitura server-side da assinatura do workspace do usuário logado. A RLS da
// tabela `subscriptions` (0001) devolve só a linha do próprio workspace, então
// um simples select já vem escopado. Usado pelo gate de paywall do (app).
export async function getCurrentSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .limit(1)
    .maybeSingle();

  return (data as Subscription | null) ?? null;
}
