import { NextResponse } from "next/server";
import { getCurrentSubscription } from "@/lib/billing/server";
import { isEntitled, trialDaysLeft } from "@/lib/billing/entitlement";

export const runtime = "nodejs";

// Estado da assinatura do usuário logado — usado pela tela /planos/obrigado para
// detectar (via polling) quando o webhook liberou a conta após o pagamento.
export async function GET() {
  const sub = await getCurrentSubscription();
  return NextResponse.json(
    {
      entitled: isEntitled(sub),
      status: sub?.status ?? null,
      plan: sub?.plan ?? null,
      trialDaysLeft: trialDaysLeft(sub),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
