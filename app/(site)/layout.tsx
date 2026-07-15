import "./site.css";
import { Archivo } from "next/font/google";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";

// Display da marca (proposta 4.3 do doc de UI/UX): Archivo 800/900 só em
// headlines — Inter segue no corpo. Aplicada primeiro na LP como teste.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-archivo",
});

// Site institucional/marketing (público). Chrome próprio: nav fixa + footer.
// O app logado vive no grupo (app); a auth no (auth). Route group não entra na URL.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`site ${archivo.variable} flex min-h-dvh flex-col`}>
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
