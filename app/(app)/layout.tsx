import "./app.css";
import { AppShell } from "@/components/app/shell";

// Área logada — shell portado do protótipo (sidebar 252px + topbar 68px,
// estilos em ./app.css). Dados ainda são demo; Supabase entra na fase do schema.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
