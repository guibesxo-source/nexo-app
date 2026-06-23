import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresh da sessão Supabase (cookies) + guarda de rotas da área logada.
// Rodado pelo proxy.ts da raiz. Sem sessão → manda pro /login.

// Rotas que exigem usuário autenticado. `/planos` exige login mas NÃO assinatura
// (fica fora do grupo (app), então não passa pelo gate de paywall do layout).
const PROTECTED = [
  "/welcome",
  "/dashboard",
  "/events",
  "/inscritos",
  "/financeiro",
  "/checklist",
  "/membros",
  "/integracoes",
  "/config",
  "/planos",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalida o token e mantém o cookie de sessão vivo. NÃO remover.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    const dest = path + request.nextUrl.search; // ex.: /planos?cycle=anual
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(dest)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
