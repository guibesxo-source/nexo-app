"use client";

/* ============================================================
   NEXO App · Kit compartilhado (design system da área logada).
   Migrado do estilo createElement do protótipo para JSX na F2,
   quando as views ganharam dados reais. Classes em app/(app)/app.css.
   ============================================================ */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ---------- Icon set (stroke, currentColor) ---------- */
export const I: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  calendar: "M3 9h18M7 3v3m10-3v3M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  wallet: "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z",
  check: "M20 6 9 17l-5-5",
  checkSquare: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  team: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  search: "M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  plus: "M12 5v14M5 12h14",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  trending: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  dots: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  chevDown: "M6 9l6 6 6-6",
  chevRight: "M9 18l6-6-6-6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  mapPin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  menu: "M3 12h18M3 6h18M3 18h18",
  ticket: "M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2zM13 5v14",
  bolt: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  sparkle: "M12 3l1.9 5.8L20 10.7l-5.1 2.9L12 19l-2.9-5.4L4 10.7l6.1-1.9L12 3z",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  x: "M18 6 6 18M6 6l12 12",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  paperclip: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  chevUp: "M18 15l-6-6-6 6",
  image: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  chevLeft: "M15 18l-6-6 6-6",
  panelLeft: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 3v18",
  grip: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  refresh: "M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5",
};

export function Icon({ name, size }: { name: string; size?: number }) {
  const d = I[name] || "";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size || 18}
      height={size || 18}
    >
      {d.split(/(?=M)/).map((seg, i) => (
        <path key={i} d={seg} />
      ))}
    </svg>
  );
}

/* ---------- Avatar ---------- */
const AV_PALETTE = [
  "#F97316", "#0EA5E9", "#A855F7", "#10B981", "#F43F5E", "#EAB308",
  "#6366F1", "#14B8A6", "#EC4899", "#0891B2", "#8B5CF6", "#F59E0B",
];

/** Cor estável derivada das iniciais (sem mapa fixo, funciona p/ qualquer pessoa). */
export function avatarColor(initials: string): string {
  let acc = 0;
  for (const ch of initials) acc = (acc * 31 + ch.charCodeAt(0)) % 997;
  return AV_PALETTE[acc % AV_PALETTE.length];
}

export function Avatar({ initials, color, size, src }: {
  initials: string; color?: string; size?: string; src?: string | null;
}) {
  const c = color || avatarColor(initials || "?");
  return (
    <span
      className={"avatar" + (size ? " " + size : "")}
      style={
        src
          ? { backgroundImage: `url("${src}")`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: c }
      }
    >
      {src ? "" : initials}
    </span>
  );
}

/* ---------- Badge ---------- */
export function Badge({ tone, dot, children }: { tone?: string; dot?: boolean; children?: ReactNode }) {
  return (
    <span className={"badge " + (tone || "gray")}>
      {dot && <i />}
      {children}
    </span>
  );
}

/* ---------- Toast system ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
let toastSeq = 0;

export function ToastHost({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const push = (msg: string) => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="tk">✓</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Page header ---------- */
export function PageHead({ eyebrow, title, sub, actions }: {
  eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({ title, link, onLink, children, pad0, style }: {
  title?: ReactNode; link?: string; onLink?: () => void; children?: ReactNode;
  pad0?: boolean; style?: CSSProperties;
}) {
  return (
    <div className={"card" + (pad0 ? " card-pad-0" : "")} style={style}>
      {(title || link) && (
        <div className="card-head" style={pad0 ? { padding: "18px 20px 0" } : undefined}>
          <div className="card-title">{title}</div>
          {link && (
            <a className="card-link" onClick={onLink}>
              {link}
              <Icon name="chevRight" size={13} />
            </a>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- KPI ---------- */
export function Kpi({ icon, iconTone, value, label, delta, deltaDir }: {
  icon: string; iconTone?: string; value: ReactNode; label: ReactNode;
  delta?: ReactNode; deltaDir?: "up" | "down" | "flat";
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className={"kpi-ic" + (iconTone ? " " + iconTone : "")}>
          <Icon name={icon} />
        </span>
        {delta && (
          <span className={"kpi-delta " + (deltaDir || "flat")}>
            {deltaDir === "up" && <Icon name="arrowUp" size={13} />}
            {deltaDir === "down" && <Icon name="arrowDown" size={13} />}
            {delta}
          </span>
        )}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  );
}

/* ---------- Bar chart ---------- */
export function BarChart({ data, lastAlt }: { data: { l: string; v: number }[]; lastAlt?: boolean }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="col" key={i}>
          <div
            className={"b" + (lastAlt && i === data.length - 1 ? " alt" : "")}
            style={{ height: (d.v / max) * 100 + "%" }}
          >
            <span className="bval">{d.v}</span>
          </div>
          <div className="cl">{d.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Donut ---------- */
export function Donut({ pct, label, legend, size }: {
  pct: number; label: string; legend?: { color: string; label: string; value: string }[];
  size?: number;
}) {
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{
          background: `conic-gradient(var(--green) 0 ${pct}%, #E8E8E5 ${pct}% 100%)`,
          ...(size ? { width: size, height: size } : {}),
        }}
      >
        <div className="center">
          <div className="n">{pct}%</div>
          <div className="l">{label}</div>
        </div>
      </div>
      {legend && (
        <div className="legend">
          {legend.map((lg, i) => (
            <div className="lg-row" key={i}>
              <span className="sw" style={{ background: lg.color }} />
              <span className="lk">{lg.label}</span>
              <span className="lv">{lg.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Sparkline (area svg) ---------- */
export function Spark({ points, color }: { points: number[]; color?: string }) {
  const w = 100, hh = 64, pad = 4;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const pts = points.map((p, i) => [i * step, hh - pad - ((p - min) / range) * (hh - pad * 2)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w} ${hh} L0 ${hh} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${hh}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor={color || "#00E47C"} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color || "#00E47C"} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path
        d={line}
        fill="none"
        stroke={color || "#00B863"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={"toggle" + (on ? " on" : "")} onClick={() => onChange(!on)} />;
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, footer, width }: {
  title: ReactNode; onClose: () => void; children?: ReactNode;
  footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-x" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Diálogo de confirmação (centralizado, fundo desfocado) ---------- */
export function ConfirmDialog({
  title, message, confirmLabel, cancelLabel, tone, icon, onConfirm, onCancel,
}: {
  title: ReactNode; message?: ReactNode;
  confirmLabel?: string; cancelLabel?: string;
  tone?: "danger" | "primary"; icon?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="confirm-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm" role="alertdialog" aria-modal>
        {icon && (
          <span className={"confirm-ic" + (tone === "danger" ? " danger" : "")}>
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="confirm-title">{title}</div>
        {message && <div className="confirm-msg">{message}</div>}
        <div className="confirm-foot">
          <button className="btn" onClick={onCancel}>{cancelLabel ?? "Cancelar"}</button>
          <button
            className={"btn " + (tone === "danger" ? "btn-danger" : "btn-primary")}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Input de moeda (máscara R$ pt-BR, valor em centavos) ---------- */
export function MoneyInput({ cents, onCents, autoFocus, placeholder }: {
  cents: number; onCents: (cents: number) => void;
  autoFocus?: boolean; placeholder?: string;
}) {
  return (
    <input
      className="input"
      inputMode="numeric"
      autoFocus={autoFocus}
      placeholder={placeholder ?? "R$ 0,00"}
      value={(cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
        onCents(parseInt(digits || "0", 10));
      }}
    />
  );
}

/* ---------- Campo de formulário (label + erro Zod) ---------- */
export function Field({ label, error, children, style }: {
  label: ReactNode; error?: string; children?: ReactNode; style?: CSSProperties;
}) {
  return (
    <div className="field" style={style}>
      <label className="field-label">{label}</label>
      {children}
      {error && <div className="field-err">{error}</div>}
    </div>
  );
}

/* ---------- Menu de ações (dropdown) ---------- */
export type MenuItem = { label: ReactNode; danger?: boolean; onClick: () => void };

export function Menu({ items, trigger, align }: {
  items: MenuItem[]; trigger?: ReactNode; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="row-action"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
      >
        {trigger ?? <Icon name="dots" size={16} />}
      </button>
      {open && (
        <>
          <span className="menu-scrim" onClick={() => setOpen(false)} />
          <span className={"menu" + (align === "left" ? " left" : "")} role="menu">
            {items.map((it, i) => (
              <button
                type="button"
                key={i}
                className={"menu-item" + (it.danger ? " danger" : "")}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

/* ---------- Estado vazio ---------- */
export function Empty({ icon, title, sub, action }: {
  icon?: string; title: ReactNode; sub?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-ic">
        <Icon name={icon || "sparkle"} size={22} />
      </span>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
