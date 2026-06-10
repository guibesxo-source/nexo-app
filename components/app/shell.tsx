"use client";

/* ============================================================
   NEXO App · Shell da área logada (portado de app.html +
   Sidebar/Topbar de components.jsx do protótipo).
   A navegação por hash do protótipo virou rotas reais do Next.
   ============================================================ */
import { createElement as h, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, ToastHost } from "@/components/app/kit";

export const ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  eventos: "/events",
  inscritos: "/inscritos",
  financeiro: "/financeiro",
  checklist: "/checklist",
  membros: "/membros",
  config: "/config",
};

const CRUMBS: Record<string, string> = {
  dashboard: "Dashboard", eventos: "Eventos", inscritos: "Inscritos",
  financeiro: "Financeiro", checklist: "Checklist", membros: "Membros", config: "Configurações",
};

function routeIdFromPath(pathname: string): string {
  const found = Object.entries(ROUTES).find(
    ([, path]) => pathname === path || pathname.startsWith(path + "/")
  );
  return found ? found[0] : "dashboard";
}

/** Navegação programática entre views (substitui o go(id) do protótipo). */
export function useGo() {
  const router = useRouter();
  return (id: string) => router.push(ROUTES[id] || ROUTES.dashboard);
}

/* ---------- Sidebar ---------- */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "eventos", label: "Eventos", icon: "calendar", count: "3" },
  { id: "inscritos", label: "Inscritos", icon: "users", count: "320" },
  { id: "financeiro", label: "Financeiro", icon: "wallet" },
  { id: "checklist", label: "Checklist", icon: "checkSquare", count: "3", warn: true },
];
const NAV2 = [
  { id: "membros", label: "Membros", icon: "team" },
  { id: "config", label: "Configurações", icon: "settings" },
];

function Sidebar({ active, onNav, open, eventName }: {
  active: string; onNav: (id: string) => void; open: boolean; eventName: string;
}) {
  return h(
    "aside",
    { className: "sidebar" + (open ? " open" : "") },
    h("div", { className: "sb-brand" }, h("span", { className: "sb-mark" }), "Nexo"),

    h(
      "div",
      { className: "sb-event" },
      h("span", { className: "ev-dot" }, "SM"),
      h(
        "div",
        { className: "ev-meta" },
        h("div", { className: "ev-name" }, eventName),
        h("div", { className: "ev-sub" }, "14 mai · São Paulo")
      ),
      h("span", { className: "ev-chev" }, h(Icon, { name: "chevDown", size: 14 }))
    ),

    h(
      "nav",
      { className: "sb-nav" },
      NAV.map((it) =>
        h(
          "a",
          {
            key: it.id,
            className: "sb-link" + (active === it.id ? " active" : ""),
            onClick: () => onNav(it.id),
          },
          h("span", { className: "sb-ic" }, h(Icon, { name: it.icon })),
          it.label,
          it.count && h("span", { className: "count" + (it.warn ? " warn" : "") }, it.count)
        )
      ),

      h("div", { className: "sb-section" }, "Organização"),
      NAV2.map((it) =>
        h(
          "a",
          {
            key: it.id,
            className: "sb-link" + (active === it.id ? " active" : ""),
            onClick: () => onNav(it.id),
          },
          h("span", { className: "sb-ic" }, h(Icon, { name: it.icon })),
          it.label
        )
      )
    ),

    h(
      "div",
      { className: "sb-foot" },
      h(
        "div",
        { className: "sb-user" },
        h("span", { className: "ava" }, "LF"),
        h(
          "div",
          { className: "u-meta" },
          h("div", { className: "u-name" }, "Lucas Ferraz"),
          h("div", { className: "u-mail" }, "lucas@nexo.events")
        ),
        h("span", { style: { color: "var(--dim)" } }, h(Icon, { name: "chevDown", size: 14 }))
      )
    )
  );
}

/* ---------- Topbar ---------- */
function Topbar({ crumb, onMenu }: { crumb: string; onMenu: () => void }) {
  return h(
    "header",
    { className: "topbar" },
    h("button", { className: "tb-icon-btn sb-toggle", onClick: onMenu }, h(Icon, { name: "menu", size: 18 })),
    h(
      "div",
      { className: "tb-crumb" },
      h("span", null, "Nexo"),
      h("span", { className: "sep" }, h(Icon, { name: "chevRight", size: 13 })),
      h("span", { className: "cur" }, crumb)
    ),
    h(
      "div",
      { className: "tb-search" },
      h(Icon, { name: "search", size: 15 }),
      h("input", { placeholder: "Buscar eventos, inscritos, NFs..." }),
      h("span", { className: "kbd" }, "⌘K")
    ),
    h("button", { className: "tb-icon-btn" }, h(Icon, { name: "bell", size: 18 }), h("span", { className: "dot" })),
    h("button", { className: "btn btn-primary btn-sm" }, h(Icon, { name: "plus", size: 15 }), "Novo evento")
  );
}

/* ---------- Shell ---------- */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const route = routeIdFromPath(pathname);

  const go = (id: string) => {
    setMenuOpen(false);
    router.push(ROUTES[id] || ROUTES.dashboard);
  };

  useEffect(() => {
    document.querySelector(".content")?.scrollTo({ top: 0 });
  }, [pathname]);

  return h(
    ToastHost,
    null,
    h(
      "div",
      { className: "app" },
      menuOpen && h("div", { className: "scrim", onClick: () => setMenuOpen(false) }),
      h(Sidebar, { active: route, onNav: go, open: menuOpen, eventName: "Summit de Marketing 2026" }),
      h(
        "div",
        { className: "main" },
        h(Topbar, { crumb: CRUMBS[route], onMenu: () => setMenuOpen((o) => !o) }),
        h("div", { className: "content" }, h("div", { className: "content-inner" }, children))
      )
    )
  );
}
