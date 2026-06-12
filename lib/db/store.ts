// Engine da camada de dados local: estado em memória + persistência em
// localStorage + assinatura para React (useSyncExternalStore em index.ts).
// Cada login tem sua própria base: o estado vive em `nexo:db:v1:<email>` e
// `nexo:user` guarda quem está logado para hidratar automaticamente.
// Esta é a implementação provisória de @/lib/db — quando o projeto Supabase
// existir, as mutações/leituras passam a falar com o Postgres (RLS) mantendo
// a mesma interface para a UI.

import { seedState, SEED_VERSION, type DbState } from "./seed";

const LEGACY_KEY = "nexo:db:v1"; // base única das versões anteriores
const USER_KEY = "nexo:user";

const keyFor = (email: string) => `${LEGACY_KEY}:${email}`;
const normEmail = (email: string) => email.trim().toLowerCase();

// Snapshot inicial estável: usado no SSR/primeira renderização do client.
// A hidratação a partir do localStorage acontece depois (AppShell/useEffect),
// evitando divergência entre HTML do servidor e client.
const initialState: DbState = seedState();

let state: DbState = initialState;
let activeEmail: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

export function getState(): DbState {
  return state;
}

export function getServerState(): DbState {
  return initialState;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

function persist(): boolean {
  try {
    localStorage.setItem(activeEmail ? keyFor(activeEmail) : LEGACY_KEY, JSON.stringify(state));
    return true;
  } catch {
    // storage cheio/indisponível: o app segue funcionando em memória
    return false;
  }
}

/** Salva o estado atual agora (botão "Salvar"); o auto-save já roda a cada mutação. */
export function saveNow(): boolean {
  return persist();
}

/**
 * Migra uma base salva para a versão atual preservando os dados do usuário.
 * Rejeita (null) bases mais novas que o código para não corromper nada.
 */
function migrate(saved: DbState): DbState | null {
  if (!saved || typeof saved.v !== "number") return null;
  if (saved.v > SEED_VERSION) return null;
  let s = saved;
  if (s.v < 2) {
    // v1 → v2: introduz templates de checklist (custom). Dados existentes ficam intactos.
    s = { ...s, templates: (s as Partial<DbState>).templates ?? [], v: 2 };
  }
  return s;
}

function loadKey(key: string): DbState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as DbState);
  } catch {
    return null;
  }
}

export function mutate(fn: (s: DbState) => DbState) {
  state = fn(state);
  persist();
  emit();
}

/** A hidratação do localStorage já aconteceu neste client? */
export function isHydrated(): boolean {
  return hydrated;
}

/** Carrega a base do usuário logado (chamar uma vez, no client). */
export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    activeEmail = localStorage.getItem(USER_KEY);
    let saved = activeEmail ? loadKey(keyFor(activeEmail)) : null;

    // Migração da base única antiga: adota como a base do usuário que
    // estava logado nela (uma vez) e passa a viver na chave por usuário.
    if (!saved) {
      const legacy = loadKey(LEGACY_KEY);
      if (legacy) {
        if (!activeEmail && legacy.session.user_id) {
          const owner = legacy.members.find((m) => m.id === legacy.session.user_id);
          if (owner?.email) {
            activeEmail = normEmail(owner.email);
            localStorage.setItem(USER_KEY, activeEmail);
          }
        }
        if (activeEmail) {
          saved = legacy;
          localStorage.setItem(keyFor(activeEmail), JSON.stringify(legacy));
        }
      }
    }

    if (saved) state = saved;
  } catch {
    // estado corrompido: mantém o seed
  }
  emit();
}

/**
 * Troca para a base do email informado (login): carrega o que esse usuário
 * já tinha neste navegador ou nasce um workspace demo novo para ele.
 */
export function switchUser(email: string) {
  activeEmail = normEmail(email);
  try {
    localStorage.setItem(USER_KEY, activeEmail);
  } catch {
    // sem storage: segue em memória
  }
  state = loadKey(keyFor(activeEmail)) ?? seedState();
  persist();
  emit();
}

/** Logout: grava a base do usuário com a sessão fechada e volta ao seed neutro. */
export function endSession() {
  state = { ...state, session: { ...state.session, user_id: null } };
  persist();
  activeEmail = null;
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // sem storage: nada a limpar
  }
  state = seedState();
  emit();
}

/** Restaura o workspace demo do zero (Config → zona de perigo). */
export function resetDemo() {
  const fresh = seedState();
  // preserva a sessão para não deslogar ao resetar os dados
  fresh.session = { ...state.session, selected_event_id: fresh.session.selected_event_id };
  state = fresh;
  persist();
  emit();
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export type { DbState };
