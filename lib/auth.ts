import type { User } from "@supabase/supabase-js";

/** Nome de exibição do usuário Supabase: metadata → antes do @ do email. */
export function displayNameFromUser(u: User): string {
  const meta = u.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || u.email?.split("@")[0] || "Você";
}
