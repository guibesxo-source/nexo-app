// Camada de acesso a dados do Nexo — a UI importa SOMENTE daqui.
// Implementação atual: store local persistido no navegador (F2 sem Supabase).
// Quando o projeto Supabase nascer, as funções de actions.ts viram queries/
// Server Actions e useDb passa a hidratar do Postgres — a UI não muda.

"use client";

import { useSyncExternalStore } from "react";
import { getServerState, getState, isHydrated, subscribe, type DbState } from "./store";

/** Estado reativo do banco local. A referência muda a cada mutação. */
export function useDb(): DbState {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

/** True depois que o estado salvo do navegador foi carregado (só no client). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, isHydrated, () => false);
}

export { hydrate, refreshAttendees, resetDemo, saveNow, type DbState } from "./store";
export * from "./actions";
export * from "./derived";
