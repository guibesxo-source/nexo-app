import { createClient } from "@supabase/supabase-js";

// Client server-side com a SERVICE ROLE — fura a RLS. Use SOMENTE em route
// handlers/Edge Functions (NUNCA em client components): a chave de service role
// não pode transitar para o browser. Usado pelo webhook /api/ingest/* que grava
// inscritos sem sessão de usuário (a submissão vem de uma LP externa).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
