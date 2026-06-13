import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Convenção `proxy` do Next 16 (substitui `middleware`). Refresca a sessão
// Supabase e protege as rotas da área logada.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Roda em tudo, menos API, estáticos e imagens — assim o cookie de sessão
  // é refrescado nas navegações de página.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
