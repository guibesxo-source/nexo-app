import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutBodySchema } from "@/lib/validations/abacate";
import { createPixCheckout, createCardSubscription } from "@/lib/integrations/abacate";

export const runtime = "nodejs";

// Mapa ciclo:método → env do produto na AbacatePay + como cobrar.
//   anual:pix   → produto one-time PIX (libera 365 dias)
//   anual:card  → assinatura ANNUALLY no cartão
//   mensal:card → assinatura MONTHLY no cartão
// mensal:pix não existe (PIX não auto-renova — não faz sentido mensal).
const PRODUCTS: Record<string, { env: string; kind: "pix" | "card" }> = {
  "anual:pix": { env: "ABACATE_FOUNDER_ANNUAL_PIX_PRODUCT_ID", kind: "pix" },
  "anual:card": { env: "ABACATE_FOUNDER_ANNUAL_CARD_PRODUCT_ID", kind: "card" },
  "mensal:card": { env: "ABACATE_FOUNDER_MONTHLY_CARD_PRODUCT_ID", kind: "card" },
};

// Cria o checkout do plano Fundador para o workspace do usuário logado e devolve
// a URL de pagamento. A liberação real da conta vem do webhook (/api/billing/webhook).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = checkoutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Plano ou método inválido" }, { status: 400 });
  }
  const { cycle, method } = parsed.data;

  const product = PRODUCTS[`${cycle}:${method}`];
  if (!product) {
    return NextResponse.json(
      { error: "No mensal o pagamento é só no cartão. Para PIX, escolha o plano anual." },
      { status: 400 }
    );
  }
  const productId = process.env[product.env];
  if (!productId) {
    return NextResponse.json(
      { error: "Plano indisponível no momento. Tente o outro método/ciclo." },
      { status: 503 }
    );
  }

  const { data: mem } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const workspaceId = (mem as { workspace_id?: string } | null)?.workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 409 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const input = {
    productId,
    workspaceId,
    completionUrl: `${origin}/planos/obrigado`,
    returnUrl: `${origin}/planos`,
  };

  try {
    const checkout =
      product.kind === "pix"
        ? await createPixCheckout(input)
        : await createCardSubscription(input);
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar o checkout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
