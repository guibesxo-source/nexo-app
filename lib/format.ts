// Helpers de formatação pt-BR usados pelas views.

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Datas-só ("2026-06-10") seriam interpretadas como UTC e voltariam um dia
// no fuso local (GMT-3); força interpretação local.
function parseLocal(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseLocal(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} · ${d.getFullYear()}`;
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = parseLocal(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDateShort(iso)} · ${hh}h${mm}`;
}

export function fmtMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function fmtMoneyFull(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} minuto${min > 1 ? "s" : ""}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `há ${hrs} hora${hrs > 1 ? "s" : ""}`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return fmtDate(iso);
}

/** Dias (inteiros, podem ser negativos) até a data informada. */
export function daysUntil(iso: string): number {
  const target = parseLocal(iso);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (first + last).toUpperCase();
}
