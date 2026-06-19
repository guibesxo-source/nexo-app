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
  EVENT_STATUS_META,
  eventKpis,
  selectEvent,
  selectedEvent,
  setSidebarCollapsed,
  sidebarCounts,
  useDb,
  useHydrated,
} from "@/lib/db";
import { getState } from "@/lib/db/store";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromUser } from "@/lib/auth";
import { daysUntil, fmtDateShort, initialsOf, relTime } from "@/lib/format";

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
  calendario: "/calendario",
  inscritos: "/inscritos",
  financeiro: "/financeiro",
  checklist: "/checklist",
  arquivos: "/arquivos",
  membros: "/membros",
  integracoes: "/integracoes",
  config: "/config",
};

const CRUMBS: Record<string, string> = {
  dashboard: "Dashboard", eventos: "Eventos", calendario: "Calendário",
  inscritos: "Inscritos", financeiro: "Financeiro", checklist: "Checklist",
  arquivos: "Arquivos", membros: "Membros", integracoes: "APIs & Integrações", config: "Configurações",
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
type SubmenuItem = { label: string; icon: string; tab?: string };

const SUBMENUS: Record<string, SubmenuItem[]> = {
  eventos: [
    { label: "Todos os eventos", icon: "grid" },
    { label: "Páginas de inscrição", icon: "link" },
    { label: "Ingressos & lotes", icon: "ticket" },
    { label: "Programação", icon: "calendarDays" },
    { label: "Capas & branding", icon: "image" },
  ],
  inscritos: [
    { label: "Lista de inscritos", icon: "users" },
    { label: "Check-in", icon: "checkSquare", tab: "checkin" },
    { label: "Credenciais & crachás", icon: "ticket" },
    { label: "Listas & segmentos", icon: "filter" },
    { label: "Comunicação", icon: "mail" },
  ],
  financeiro: [
    { label: "Visão geral", icon: "grid" },
    { label: "Transações", icon: "wallet" },
    { label: "Repasses & saques", icon: "download" },
    { label: "Cupons & descontos", icon: "ticket" },
    { label: "Notas fiscais", icon: "note" },
  ],
  checklist: [
    { label: "Todas as tarefas", icon: "grid", tab: "todas" },
    { label: "Tarefas abertas", icon: "clock", tab: "abertas" },
    { label: "Atrasadas", icon: "bolt", tab: "atrasadas" },
    { label: "Templates & ClickUp", icon: "sparkle", tab: "templates" },
    { label: "Nova tarefa", icon: "plus", tab: "nova" },
  ],
};

const STATUS_TONE_VARS: Record<string, { bg: string; fg: string }> = {
  green: { bg: "var(--green-soft)", fg: "var(--green-deep)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  blue: { bg: "var(--blue-soft)", fg: "var(--blue)" },
  red: { bg: "var(--red-soft)", fg: "var(--red)" },
  gray: { bg: "var(--panel)", fg: "var(--dim)" },
};

function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d > 0) return `faltam ${d} dia${d === 1 ? "" : "s"}`;
  if (d === 0) return "é hoje";
  const abs = Math.abs(d);
  return `há ${abs} dia${abs === 1 ? "" : "s"}`;
}

function EventContext() {
  const db = useDb();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ev = selectedEvent(db);

  if (!ev) {
    return (
      <>
        <div className="sb-evctx sb-expanded-only">
          <button className="sb-event-trigger" onClick={() => router.push("/events")}>
            <div className="sb-evrow">
              <div className="sb-evtile empty">+</div>
              <div className="sb-evtile-meta">
                <div className="sb-evtile-name">Nenhum evento</div>
                <div className="sb-evtile-sub">Crie o primeiro</div>
              </div>
            </div>
          </button>
        </div>
        <div className="sb-evctx sb-collapsed-only">
          <button className="sb-evmini-tile empty" onClick={() => router.push("/events")}>+</button>
        </div>
      </>
    );
  }

  const k = eventKpis(db, ev.id);
  const meta = EVENT_STATUS_META[ev.status];
  const tone = STATUS_TONE_VARS[meta.tone] ?? STATUS_TONE_VARS.gray;
  const capacityPct = ev.capacity ? Math.min(100, Math.round((k.total / ev.capacity) * 100)) : 0;
  const checklistPct = k.tasksTotal ? Math.round((k.tasksDone / k.tasksTotal) * 100) : 0;
  const checklistColor = checklistPct < 40 ? "var(--amber)" : "var(--green-deep)";
  const metaLine = `${fmtDateShort(ev.starts_at)} · ${ev.location}`;
  const ringBg = `conic-gradient(var(--green-deep) 0 ${capacityPct}%, var(--ring-track) ${capacityPct}% 100%)`;

  const header = (
    <div className="sb-evrow">
      <div className="sb-evtile" style={{ background: ev.cover }}>{evInitials(ev.name)}</div>
      <div className="sb-evtile-meta">
        <div className="sb-evtile-name">{ev.name}</div>
        <div className="sb-evtile-sub">{metaLine}</div>
      </div>
    </div>
  );

  const stats = (
    <div className="sb-evstats">
      <div className="sb-evring" style={{ background: ringBg }}><span>{capacityPct}%</span></div>
      <div className="sb-evstats-meta">
        <div className="sb-evstatus-row">
          <span className="sb-evbadge" style={{ background: tone.bg, color: tone.fg }}><i />{meta.label}</span>
          <span className="sb-evcountdown"><Icon name="clock" size={12} />{countdownLabel(ev.starts_at)}</span>
        </div>
        <div className="sb-evchk-row">
          <span className="sb-evchk-lbl">Checklist</span>
          <span className="sb-evchk-val">{checklistPct}%</span>
        </div>
        <div className="sb-evchk-track"><i style={{ width: `${checklistPct}%`, background: checklistColor }} /></div>
      </div>
    </div>
  );

  return (
    <>
      <div className="sb-evctx sb-expanded-only">
        <div className={"sb-event-trigger" + (detailsOpen ? " details-open" : " details-closed")}>
          <button className="sb-evhead" onClick={() => setOpen((o) => !o)}>
            <div className="sb-evtile" style={{ background: ev.cover }}>{evInitials(ev.name)}</div>
            <div className="sb-evtile-meta">
              <div className="sb-evtile-name">{ev.name}</div>
              <div className="sb-evtile-sub">{metaLine}</div>
            </div>
            <span className={"sb-evchev" + (open ? " open" : "")}><Icon name="chevDown" size={15} /></span>
          </button>

          {detailsOpen ? (
            <>
              <div className="sb-evsep" />
              {stats}
              <button
                className="sb-evdetails-toggle"
                title="Recolher detalhes"
                onClick={() => setDetailsOpen(false)}
              >
                <Icon name="chevUp" size={13} />
              </button>
            </>
          ) : (
            <div className="sb-evcompact">
              <span className="sb-evbadge" style={{ background: tone.bg, color: tone.fg }}><i />{meta.label}</span>
              <span className="sb-evcountdown"><Icon name="clock" size={12} />{countdownLabel(ev.starts_at)}</span>
              <button
                className="sb-evdetails-toggle"
                title="Mostrar detalhes"
                onClick={() => setDetailsOpen(true)}
              >
                <Icon name="chevDown" size={13} />
              </button>
            </div>
          )}
        </div>
        {open && (
          <>
            <span className="menu-scrim" onClick={() => setOpen(false)} />
            <div className="sb-evpop">
              <div className="sb-evpop-head">Trocar de evento</div>
              {db.events.map((event) => {
                const eventMeta = EVENT_STATUS_META[event.status];
                const eventTone = STATUS_TONE_VARS[eventMeta.tone] ?? STATUS_TONE_VARS.gray;
                return (
                  <button
                    key={event.id}
                    className={"sb-evpop-opt" + (event.id === ev.id ? " active" : "")}
                    onClick={() => { selectEvent(event.id); setOpen(false); }}
                  >
                    <div className="sb-evtile sm" style={{ background: event.cover }}>{evInitials(event.name)}</div>
                    <div className="sb-evtile-meta">
                      <div className="sb-evtile-name">{event.name}</div>
                      <div className="sb-evtile-sub">{fmtDateShort(event.starts_at)} · {event.location}</div>
                    </div>
                    <span className="sb-evbadge sm" style={{ background: eventTone.bg, color: eventTone.fg }}>
                      <i />{eventMeta.label}
                    </span>
                  </button>
                );
              })}
              <div className="sb-evpop-sep" />
              <button className="sb-evpop-all" onClick={() => { setOpen(false); router.push("/events"); }}>
                <Icon name="grid" size={15} />Ver todos os eventos
              </button>
            </div>
          </>
        )}
      </div>

      <div className="sb-evctx sb-collapsed-only">
        <div className="sb-event-mini">
          <div className="sb-evmini-tile" style={{ background: ev.cover }}>{evInitials(ev.name)}</div>
          <span className="sb-evmini-dot" style={{ background: tone.fg }} />
          <div className="sb-flyout sb-evflyout">
            {header}
            <div className="sb-evsep" />
            {stats}
          </div>
        </div>
      </div>
    </>
  );
}

type NavItem = {
  id: string;
  label: string;
  icon: string;
  count: number;
  warn: boolean;
};

function Sidebar({ active, onNav, open, collapsed, onToggleCollapse }: {
  active: string; onNav: (id: string, query?: string) => void; open: boolean; collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const db = useDb();
  const router = useRouter();
  const counts = sidebarCounts(db);
  const user = currentUser(db);
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  const [dismissedFlyout, setDismissedFlyout] = useState<string | null>(null);

  const subOpen = (id: string) => openSubs[id] ?? id === active;
  const toggleSub = (id: string) => setOpenSubs((state) => ({ ...state, [id]: !subOpen(id) }));
  const navSub = (parent: string, tab?: string) => {
    onNav(parent, tab ? `tab=${tab}` : undefined);
    if (collapsed) {
      setDismissedFlyout(parent);
      (document.activeElement as HTMLElement | null)?.blur();
    }
    if (parent === "inscritos") {
      window.dispatchEvent(new CustomEvent("nexo:tab", { detail: tab ?? "todos" }));
    }
    if (parent === "checklist") {
      window.dispatchEvent(new CustomEvent("nexo:checklist", { detail: tab ?? "todas" }));
    }
  };

  const nav1: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: "grid", count: 0, warn: false },
    { id: "eventos", label: "Eventos", icon: "calendar", count: counts.events, warn: false },
    { id: "calendario", label: "Calendário", icon: "calendarDays", count: 0, warn: false },
    { id: "inscritos", label: "Inscritos", icon: "users", count: counts.attendees, warn: false },
    { id: "financeiro", label: "Financeiro", icon: "wallet", count: 0, warn: false },
    {
      id: "checklist", label: "Checklist", icon: "checkSquare",
      count: counts.lateTasks > 0 ? counts.lateTasks : counts.openTasks,
      warn: counts.lateTasks > 0,
    },
    { id: "arquivos", label: "Arquivos", icon: "paperclip", count: 0, warn: false },
  ];
  const nav2: NavItem[] = [
    { id: "membros", label: "Membros", icon: "team", count: 0, warn: false },
    { id: "integracoes", label: "APIs & Integrações", icon: "link", count: 0, warn: false },
    { id: "config", label: "Configurações", icon: "settings", count: 0, warn: false },
  ];

  const renderRow = (it: NavItem) => {
    const hasSub = !!SUBMENUS[it.id];
    const showSubmenu = hasSub && (subOpen(it.id) || collapsed);
    return (
      <div
        key={it.id}
        className={"sb-navitem" + (dismissedFlyout === it.id ? " flyout-dismissed" : "")}
        onMouseLeave={() => dismissedFlyout === it.id && setDismissedFlyout(null)}
      >
        <button
          className="sb-row"
          data-active={active === it.id ? "true" : "false"}
          onClick={() => {
            onNav(it.id);
            if (hasSub) setOpenSubs((state) => ({ ...state, [it.id]: true }));
          }}
        >
          <span className="sb-ico"><Icon name={it.icon} /></span>
          <span className="sb-text sb-row-label">{it.label}</span>
          {it.count > 0 && <span className={"sb-text sb-pill-counter" + (it.warn ? " warn" : "")}>{it.count}</span>}
          {it.count > 0 && <span className={"sb-dot-counter" + (it.warn ? " warn" : "")} />}
          {hasSub ? (
            <span
              className={"sb-text sb-chev" + (subOpen(it.id) ? " open" : "")}
              onClick={(event) => { event.stopPropagation(); toggleSub(it.id); }}
            >
              <Icon name="chevDown" size={14} />
            </span>
          ) : (
            <span className="sb-active-bar" />
          )}
          <span className="sb-tooltip">{it.label}{it.count > 0 ? ` · ${it.count}` : ""}</span>
        </button>
        {showSubmenu && (
          <div className="sb-sublist">
            <span className="sb-subline" />
            {SUBMENUS[it.id].map((sub) => (
              <button
                key={sub.label}
                className="sb-row sb-sub"
                title={collapsed ? sub.label : undefined}
                onClick={() => navSub(it.id, sub.tab)}
              >
                <span className="sb-ico"><Icon name={sub.icon} size={15} /></span>
                <span className="sb-text">{sub.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const wsName = db.workspace.name || "Workspace";
  const totalEvents = db.events.length;
  const activeEvents = counts.events;
  const planPct = totalEvents > 0 ? Math.round((activeEvents / totalEvents) * 100) : 0;

  return (
    <aside className={"sidebar nexo-sb" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
      <div className="sb-brand" role="button" title="Ir para o dashboard" onClick={() => onNav("dashboard")}>
        <span className="sb-mark" />
        <span className="sb-text sb-brand-text">Nexo</span>
      </div>

      <EventContext />

      <nav className="sb-nav">
        {nav1.map(renderRow)}
        <div className="sb-section sb-expanded-only">Organização</div>
        <div className="sb-section-line sb-collapsed-only" />
        {nav2.map(renderRow)}
      </nav>

      <div className="sb-foot">
        <button className="sb-row sb-collapse-row" onClick={onToggleCollapse}>
          <span className={"sb-ico sb-collapse-ico" + (collapsed ? " flipped" : "")}>
            <Icon name="chevLeft" size={17} />
          </span>
          <span className="sb-text">Recolher menu</span>
          <span className="sb-tooltip">{collapsed ? "Expandir menu" : "Recolher menu"}</span>
        </button>

        <div className="sb-plan sb-expanded-only">
          <div className="sb-plan-logo">{wsName.charAt(0).toUpperCase()}</div>
          <div className="sb-plan-meta">
            <div className="sb-plan-top">
              <span className="sb-plan-name">{wsName}</span>
              <span className="sb-plan-badge">Beta</span>
            </div>
            <div className="sb-plan-bar-row">
              <div className="sb-plan-bar"><i style={{ width: `${planPct}%` }} /></div>
              <span className="sb-plan-count">{activeEvents}/{totalEvents}</span>
            </div>
          </div>
        </div>

        <div className="sb-foot-sep sb-expanded-only" />

        <div className="sb-user sb-row">
          <span
            className="ava"
            style={
              user?.avatar
                ? { backgroundImage: `url("${user.avatar}")`, backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            {user?.avatar ? "" : (user?.initials ?? "?")}
          </span>
          <div className="sb-text u-meta">
            <div className="u-name">{user?.name ?? "—"}</div>
            <div className="u-mail">{user?.email ?? ""}</div>
          </div>
          <button
            className="sb-text u-logout"
            title="Sair"
            onClick={async () => {
              await createClient().auth.signOut();
              logout();
              router.replace("/login");
            }}
          >
            <Icon name="logout" size={16} />
          </button>
          <span className="sb-tooltip">{(user?.name ?? "") + " · Sair"}</span>
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
  const leadText = (a: { lead_fields?: { label: string; value: string }[] }) =>
    (a.lead_fields ?? []).map((field) => `${field.label} ${field.value}`).join(" ");
  const events = qq
    ? db.events.filter((e) => (e.name + " " + e.location).toLowerCase().includes(qq)).slice(0, 3)
    : [];
  const people = qq
    ? db.attendees
        .filter(
          (a) =>
            a.status !== "cancelado" &&
            (a.name + " " + a.email + " " + a.company + " " + leadText(a)).toLowerCase().includes(qq)
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
  const [authed, setAuthed] = useState<boolean | null>(null);

  const route = routeIdFromPath(pathname);
  const user = ready ? currentUser(db) : undefined;
  const collapsed = db.settings.sidebar_collapsed ?? false;

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
      setAuthed(!!u);
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

  const go = (id: string, query?: string) => {
    setMenuOpen(false);
    const path = ROUTES[id] || ROUTES.dashboard;
    router.push(query ? `${path}?${query}` : path);
  };

  if (!ready || authed === null) return null; // carregando workspace
  if (!authed) return null; // sem sessão → o efeito acima redireciona pro /login

  // Autenticado, mas o workspace não carregou (ex.: banco sem a migration
  // aplicada, ou provisionamento falhou). Mostra um erro em vez de tela branca.
  if (!user)
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
            Não consegui carregar seu workspace
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--dim)", marginBottom: 22 }}>
            Confirme que o banco foi configurado (migration aplicada no Supabase) e tente de novo.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Tentar de novo
            </button>
            <button
              className="btn"
              onClick={async () => {
                await createClient().auth.signOut();
                logout();
                router.replace("/login");
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <ToastHost>
      <UiCtx.Provider value={{ openNewEvent: () => setNewEventOpen(true) }}>
        <div className={"app" + (collapsed ? " sb-collapsed" : "")}>
          {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
          <Sidebar
            active={route}
            onNav={go}
            open={menuOpen}
            collapsed={collapsed}
            onToggleCollapse={() => setSidebarCollapsed(!collapsed)}
          />
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
