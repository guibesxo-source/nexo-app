"use client";

/* ============================================================
   NEXO App · Shell da área logada — F2: JSX idiomático, dados
   reais via @/lib/db (contadores, seletor de evento, sessão).
   ============================================================ */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Icon, ToastHost } from "@/components/app/kit";
import { EventFormModal } from "@/components/app/event-form";
import {
  clearRecentSearches,
  currentUser,
  hydrate,
  login,
  logout,
  pushRecentSearch,
  selectEvent,
  selectedEvent,
  sidebarCounts,
  useDb,
  useHydrated,
} from "@/lib/db";
import { getState } from "@/lib/db/store";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromUser } from "@/lib/auth";
import { fmtDateShort, initialsOf, relTime } from "@/lib/format";

/** Iniciais de evento: duas primeiras palavras (ex.: "Summit de…" → SD ≠ pessoas). */
function evInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();
}

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

/* ---------- UI compartilhada (abrir modal de novo evento de qualquer view) ---------- */
const UiCtx = createContext<{ openNewEvent: () => void }>({ openNewEvent: () => {} });
export const useUi = () => useContext(UiCtx);

/* ---------- Sidebar ---------- */
function EventSwitcher() {
  const db = useDb();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ev = selectedEvent(db);

  if (!ev) {
    return (
      <div className="sb-event" onClick={() => router.push("/events")}>
        <div className="ev-meta">
          <div className="ev-name">Nenhum evento</div>
          <div className="ev-sub">Crie o primeiro</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sb-event-wrap">
      <div className="sb-event" onClick={() => setOpen((o) => !o)}>
        <span className="ev-dot">{evInitials(ev.name)}</span>
        <div className="ev-meta">
          <div className="ev-name">{ev.name}</div>
          <div className="ev-sub">{fmtDateShort(ev.starts_at)} · {ev.location}</div>
        </div>
        <span className="ev-chev"><Icon name="chevDown" size={14} /></span>
      </div>
      {open && (
        <>
          <span className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="sb-event-pop">
            {db.events.map((e) => (
              <button
                key={e.id}
                className={"sb-event-opt" + (e.id === ev.id ? " active" : "")}
                onClick={() => { selectEvent(e.id); setOpen(false); }}
              >
                <span className="ev-dot">{evInitials(e.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {e.name}
                  <span className="sub">{fmtDateShort(e.starts_at)} · {e.location}</span>
                </span>
              </button>
            ))}
            <button
              className="sb-event-opt"
              style={{ color: "var(--green-deep)" }}
              onClick={() => { setOpen(false); router.push("/events"); }}
            >
              Ver todos os eventos →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Sidebar({ active, onNav, open }: {
  active: string; onNav: (id: string) => void; open: boolean;
}) {
  const db = useDb();
  const router = useRouter();
  const counts = sidebarCounts(db);
  const user = currentUser(db);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "grid", count: 0, warn: false },
    { id: "eventos", label: "Eventos", icon: "calendar", count: counts.events, warn: false },
    { id: "inscritos", label: "Inscritos", icon: "users", count: counts.attendees, warn: false },
    { id: "financeiro", label: "Financeiro", icon: "wallet", count: 0, warn: false },
    {
      id: "checklist", label: "Checklist", icon: "checkSquare",
      count: counts.lateTasks > 0 ? counts.lateTasks : counts.openTasks,
      warn: counts.lateTasks > 0,
    },
  ];
  const nav2 = [
    { id: "membros", label: "Membros", icon: "team" },
    { id: "config", label: "Configurações", icon: "settings" },
  ];

  return (
    <aside className={"sidebar" + (open ? " open" : "")}>
      <div
        className="sb-brand"
        role="button"
        title="Ir para o dashboard"
        onClick={() => onNav("dashboard")}
      >
        <span className="sb-mark" />Nexo
      </div>

      <EventSwitcher />

      <nav className="sb-nav">
        {nav.map((it) => (
          <a
            key={it.id}
            className={"sb-link" + (active === it.id ? " active" : "")}
            onClick={() => onNav(it.id)}
          >
            <span className="sb-ic"><Icon name={it.icon} /></span>
            {it.label}
            {it.count > 0 && <span className={"count" + (it.warn ? " warn" : "")}>{it.count}</span>}
          </a>
        ))}

        <div className="sb-section">Organização</div>
        {nav2.map((it) => (
          <a
            key={it.id}
            className={"sb-link" + (active === it.id ? " active" : "")}
            onClick={() => onNav(it.id)}
          >
            <span className="sb-ic"><Icon name={it.icon} /></span>
            {it.label}
          </a>
        ))}
      </nav>

      <div className="sb-foot">
        <div className="sb-user">
          <span className="ava">{user?.initials ?? "?"}</span>
          <div className="u-meta">
            <div className="u-name">{user?.name ?? "—"}</div>
            <div className="u-mail">{user?.email ?? ""}</div>
          </div>
          <button
            className="row-action"
            title="Sair"
            onClick={async () => {
              await createClient().auth.signOut();
              logout();
              router.replace("/login");
            }}
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ---------- Busca global (overlay com blur, aberto pela topbar ou Ctrl+K) ---------- */
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const router = useRouter();
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qq = q.trim().toLowerCase();
  const events = qq
    ? db.events.filter((e) => (e.name + " " + e.location).toLowerCase().includes(qq)).slice(0, 3)
    : [];
  const people = qq
    ? db.attendees
        .filter(
          (a) =>
            a.status !== "cancelado" &&
            (a.name + " " + a.email + " " + a.company).toLowerCase().includes(qq)
        )
        .slice(0, 6)
    : [];

  const recents = db.settings.recent_searches ?? [];

  // Leva a busca para a view de Inscritos (o evento sincroniza a view já montada).
  const goSearch = (term: string) => {
    pushRecentSearch(term);
    window.dispatchEvent(new CustomEvent("nexo:search", { detail: term }));
    router.push("/inscritos?q=" + encodeURIComponent(term));
    onClose();
  };

  return (
    <div className="search-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-panel">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            autoFocus
            placeholder="Buscar inscritos, eventos, empresas..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && qq && goSearch(q.trim())}
          />
          <span className="kbd">esc</span>
        </div>

        {qq && (events.length > 0 || people.length > 0) ? (
          <div className="search-results">
            {events.length > 0 && (
              <>
                <div className="search-sec">Eventos</div>
                {events.map((e) => (
                  <button
                    key={e.id}
                    className="search-row"
                    onClick={() => {
                      pushRecentSearch(q.trim());
                      selectEvent(e.id);
                      router.push("/dashboard");
                      onClose();
                    }}
                  >
                    <span className="sr-cover" style={{ backgroundImage: e.cover }} />
                    <span className="sr-main">
                      <span className="sr-nm">{e.name}</span>
                      <span className="sr-sub">{fmtDateShort(e.starts_at)} · {e.location}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            {people.length > 0 && (
              <>
                <div className="search-sec">Inscritos</div>
                {people.map((a) => (
                  <button
                    key={a.id}
                    className="search-row"
                    onClick={() => {
                      selectEvent(a.event_id);
                      goSearch(a.name);
                    }}
                  >
                    <Avatar initials={initialsOf(a.name)} size="sm" />
                    <span className="sr-main">
                      <span className="sr-nm">{a.name}</span>
                      <span className="sr-sub">{a.email}{a.company ? ` · ${a.company}` : ""}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            <div className="search-foot">
              <span className="kbd">↵</span> ver todos os resultados em Inscritos
            </div>
          </div>
        ) : qq ? (
          <div className="search-hint">Nada encontrado para “{q.trim()}”.</div>
        ) : recents.length > 0 ? (
          <div className="search-results">
            <div className="search-sec search-sec-row">
              Pesquisas recentes
              <button className="search-clear" onClick={() => clearRecentSearches()}>
                limpar
              </button>
            </div>
            {recents.map((term) => (
              <button key={term} className="search-row" onClick={() => setQ(term)}>
                <span className="sr-clock"><Icon name="clock" size={15} /></span>
                <span className="sr-main">
                  <span className="sr-nm">{term}</span>
                </span>
                <Icon name="chevRight" size={13} />
              </button>
            ))}
          </div>
        ) : (
          <div className="search-hint">Digite para buscar em inscritos e eventos do workspace.</div>
        )}
      </div>
    </div>
  );
}

/* ---------- Topbar ---------- */

/** Painel de notificações — formato da "Atividade recente" do dashboard
    (ícone em caixa + texto com negrito + tempo), não itens de menu. */
function Notifications() {
  const db = useDb();
  const go = useGo();
  const [open, setOpen] = useState(false);
  const items = db.activity.slice(0, 8);

  const goDashboard = () => {
    setOpen(false);
    go("dashboard");
  };

  return (
    <div className="notif-wrap">
      <button
        className="tb-icon-btn"
        title="Notificações"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={18} />
        {db.activity.length > 0 && <span className="dot" />}
      </button>
      {open && (
        <>
          <span className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="notif-pop">
            <div className="notif-head">
              <span>Notificações</span>
              {db.activity.length > 0 && (
                <span className="notif-count">{db.activity.length}</span>
              )}
            </div>
            {items.length === 0 ? (
              <div className="notif-empty">
                <Icon name="bell" size={20} />
                Nada por aqui ainda — as ações no workspace aparecem nesta lista.
              </div>
            ) : (
              <div className="notif-list">
                {items.map((a) => (
                  <button key={a.id} className="notif-row" onClick={goDashboard}>
                    <span className="act-ic">{a.icon}</span>
                    <span className="notif-body">
                      <span className="notif-txt">
                        {a.text.map((s, j) => (j % 2 ? <b key={j}>{s}</b> : s))}
                      </span>
                      <span className="notif-time">{relTime(a.created_at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {items.length > 0 && (
              <button className="notif-foot" onClick={goDashboard}>
                Ver atividade completa <Icon name="chevRight" size={13} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** O tema vive no atributo data-theme do <html> (aplicado pré-paint pelo
    script inline do layout raiz); o React só observa, como faz com o db. */
function subscribeTheme(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light" as const
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("nexo:theme", next); } catch {}
  };

  return (
    <button
      className="tb-icon-btn tb-theme"
      title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
      onClick={toggle}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}

function Topbar({ crumb, onMenu, onNewEvent }: {
  crumb: string; onMenu: () => void; onNewEvent: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Atalho global Ctrl/Cmd+K abre a busca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar">
      <button className="tb-icon-btn sb-toggle" onClick={onMenu}>
        <Icon name="menu" size={18} />
      </button>
      <div className="tb-crumb">
        <span>Nexo</span>
        <span className="sep"><Icon name="chevRight" size={13} /></span>
        <span className="cur">{crumb}</span>
      </div>
      <button className="tb-search" onClick={() => setSearchOpen(true)}>
        <Icon name="search" size={15} />
        <span className="ph">Buscar inscritos, eventos...</span>
        <span className="kbd">Ctrl K</span>
      </button>
      <ThemeToggle />
      <Notifications />
      <button className="btn btn-primary btn-sm" onClick={onNewEvent}>
        <Icon name="plus" size={15} />Novo evento
      </button>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}

/* ---------- Shell ---------- */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const db = useDb();
  const ready = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);

  const route = routeIdFromPath(pathname);
  const user = ready ? currentUser(db) : undefined;

  // Hidrata o estado salvo do navegador uma única vez, no client
  // (sincroniza com o sistema externo; o re-render vem do useHydrated).
  useEffect(() => {
    hydrate();
  }, []);

  // Ponte com o Supabase Auth: a identidade real vem do Supabase. Havendo
  // usuário e sem sessão local ainda, espelha (login local). Sem usuário,
  // volta pro /login. Reage também a logout disparado em outra aba.
  useEffect(() => {
    if (!ready) return;
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!active) return;
      if (!u) {
        router.replace("/login");
        return;
      }
      if (!getState().session.user_id) {
        login(displayNameFromUser(u), u.email ?? "");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        logout();
        router.replace("/login");
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [ready, router]);

  useEffect(() => {
    document.querySelector(".content")?.scrollTo({ top: 0 });
  }, [pathname]);

  const go = (id: string) => {
    setMenuOpen(false);
    router.push(ROUTES[id] || ROUTES.dashboard);
  };

  if (!ready || !user) return null;

  return (
    <ToastHost>
      <UiCtx.Provider value={{ openNewEvent: () => setNewEventOpen(true) }}>
        <div className="app">
          {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
          <Sidebar active={route} onNav={go} open={menuOpen} />
          <div className="main">
            <Topbar
              crumb={CRUMBS[route]}
              onMenu={() => setMenuOpen((o) => !o)}
              onNewEvent={() => setNewEventOpen(true)}
            />
            <div className="content">
              <div className="content-inner">{children}</div>
            </div>
          </div>
        </div>
        {newEventOpen && <EventFormModal onClose={() => setNewEventOpen(false)} />}
      </UiCtx.Provider>
    </ToastHost>
  );
}
