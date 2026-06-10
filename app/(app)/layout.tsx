// Shell da área logada. Reservado: sidebar (--sidebar-w: 252px) + topbar (--topbar-h: 68px),
// conforme tokens de layout em globals.css — implementação na fase do MVP.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className="flex flex-1 flex-col">{children}</main>;
}
