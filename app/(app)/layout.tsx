import "./app.css";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { getCurrentSubscription } from "@/lib/billing/server";
import { isEntitled } from "@/lib/billing/entitlement";

// Área logada — shell portado do protótipo (sidebar 252px + topbar 68px,
// estilos em ./app.css). Gate de paywall central: cobre TODAS as rotas internas
// de uma vez. A RLS continua protegendo os dados; este gate é sobre acesso ao
// produto (teste expirado / assinatura inativa → vai para /planos).
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sub = await getCurrentSubscription();
  // sub == null → conta em provisionamento (logo após o signup) ou legada
  // pré-billing: não bloqueia; o trial é criado no signup/ensure-workspace.
  // Bloqueia só quando HÁ assinatura e ela não dá direito de acesso.
  if (sub && !isEntitled(sub)) redirect("/planos");

  return <AppShell>{children}</AppShell>;
}
