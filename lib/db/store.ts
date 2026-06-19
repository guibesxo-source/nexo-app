// Engine da camada de dados: estado reativo em memória (useSyncExternalStore em
// index.ts) hidratado do Supabase no login e gravado write-through a cada
// mutação. A UI segue lendo SOMENTE de @/lib/db, alheia ao banco.
//
// Fluxo: a UI muta a memória (mutate → emit, instantâneo) e dispara a escrita
// correspondente no Postgres (sb*). A hidratação resolve o workspace do usuário
// logado (via memberships, sob RLS) e monta o DbState a partir das tabelas.

import { seedState, SEED_VERSION, type DbState } from "./seed";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromUser } from "@/lib/auth";
import { seedWorkspace } from "./seed-supabase";
import type { AppSettings, TaskAttachment } from "@/types";
import * as map from "./supabase-map";

type Sb = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;

const SELECTED_KEY = "nexo:selected_event"; // estado de navegação puro (não vai pro banco)

// Snapshot inicial estável: usado no SSR/primeira renderização do client.
// A hidratação a partir do Supabase acontece depois (AppShell/useEffect).
const initialState: DbState = seedState();

let state: DbState = initialState;
let hydrated = false;
let hydrating = false;
let workspaceId: string | null = null;
let sb: Sb | null = null;
const listeners = new Set<() => void>();

function client(): Sb {
  return (sb ??= createClient());
}

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

export function isHydrated(): boolean {
  return hydrated;
}

/** Workspace ativo (null antes do login/hidratação). */
export function currentWorkspaceId(): string | null {
  return workspaceId;
}

/** Mutação só em memória + notificação ao React. O write-through é explícito nas actions. */
export function mutate(fn: (s: DbState) => DbState) {
  state = fn(state);
  emit();
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/* ---------- Write-through (fire-and-forget; no-op se não conectado) ---------- */

function logErr(ctx: string, error: { message?: string } | null) {
  if (error) console.error(`[db] ${ctx}:`, error.message ?? error);
}

export function sbInsert(table: string, rows: Row | Row[]) {
  if (!workspaceId) return;
  void client()
    .from(table)
    .insert(rows as never)
    .then(({ error }) => logErr(`insert ${table}`, error));
}

export function sbUpdate(table: string, id: string, patch: Row) {
  if (!workspaceId) return;
  void client()
    .from(table)
    .update(patch as never)
    .eq("id", id)
    .then(({ error }) => logErr(`update ${table}`, error));
}

export function sbDelete(table: string, id: string | string[]) {
  if (!workspaceId) return;
  const q = client().from(table).delete();
  void (Array.isArray(id) ? q.in("id", id) : q.eq("id", id)).then(({ error }) =>
    logErr(`delete ${table}`, error)
  );
}

/**
 * Insere vários lotes em ordem (await entre eles) — usado para restaurar um
 * evento e seus filhos respeitando as FKs (evento antes de inscritos/tarefas…).
 * Fire-and-forget para a UI; no-op se não conectado.
 */
export async function sbInsertOrdered(steps: Array<[table: string, rows: Row[]]>) {
  if (!workspaceId) return;
  for (const [table, rows] of steps) {
    if (!rows.length) continue;
    const { error } = await client().from(table).insert(rows as never);
    logErr(`insert ${table}`, error);
  }
}

/** Delete por uma coluna arbitrária (ex.: tabelas com PK que não é `id`). */
export function sbDeleteBy(table: string, column: string, value: string) {
  if (!workspaceId) return;
  void client()
    .from(table)
    .delete()
    .eq(column, value)
    .then(({ error }) => logErr(`delete ${table}`, error));
}

export function sbUpsert(table: string, rows: Row | Row[], onConflict?: string) {
  if (!workspaceId) return;
  void client()
    .from(table)
    .upsert(rows as never, onConflict ? { onConflict } : undefined)
    .then(({ error }) => logErr(`upsert ${table}`, error));
}

/** Salva o blob de settings inteiro do estado atual (preferências/tokens/dashboard). */
export function saveSettings() {
  if (!workspaceId) return;
  void client()
    .from("app_settings")
    .upsert({ workspace_id: workspaceId, data: getState().settings }, { onConflict: "workspace_id" })
    .then(({ error }) => logErr("upsert app_settings", error));
}

/** Persiste o evento selecionado (estado de navegação) no navegador. */
export function saveSelectedEvent(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // sem storage: segue só em memória
  }
}

function loadSelectedEvent(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

/* ---------- Hidratação ---------- */

/** Carrega o workspace do usuário logado a partir do Supabase (uma vez, no client). */
export async function hydrate() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  try {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return; // sem login: fica no seed neutro; o shell manda pro /login

    const fetchMembership = () =>
      supabase
        .from("memberships")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    let { data: mem } = await fetchMembership();
    if (!mem) {
      // conta sem workspace (antiga ou logo após signup): provisiona e tenta de novo
      try {
        const r = await fetch("/api/auth/ensure-workspace", { method: "POST" });
        if (r.ok) ({ data: mem } = await fetchMembership());
      } catch {
        // sem rede: segue sem workspace; o shell mostra o estado de erro
      }
    }
    if (!mem) return;
    workspaceId = String((mem as Row).workspace_id);

    const [wsR, membersR, eventsR, attendeesR, tasksR, attachR, catsR, txR, actR, tplR, setR, ingestR] =
      await Promise.all([
        supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
        supabase.from("members").select("*").order("created_at"),
        supabase.from("events").select("*").order("created_at", { ascending: false }),
        supabase.from("attendees").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("task_attachments").select("*"),
        supabase.from("budget_categories").select("*"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("checklist_templates").select("*"),
        supabase.from("app_settings").select("data").eq("workspace_id", workspaceId).maybeSingle(),
        // Tolerante: se a tabela ainda não existir (migration 0002 não aplicada),
        // supabase-js devolve { data:null, error } sem lançar — vira [].
        supabase.from("ingest_endpoints").select("*").order("created_at", { ascending: false }),
      ]);

    const attByTask = new Map<string, TaskAttachment[]>();
    for (const r of (attachR.data ?? []) as Row[]) {
      const key = String(r.task_id);
      attByTask.set(key, [...(attByTask.get(key) ?? []), map.rowToAttachment(r)]);
    }

    const memberRows = (membersR.data ?? []) as Row[];
    const me = memberRows.find((r) => r.profile_id === user.id);
    const ws = (wsR.data ?? null) as Row | null;
    const events = (eventsR.data ?? []) as Row[];
    const settings = ((setR.data as Row | null)?.data as AppSettings) ?? { toggles: {} };
    const attendeeLeadFields = settings.attendee_lead_fields ?? {};
    const attendees = ((attendeesR.data ?? []) as Row[]).map((r) => {
      const attendee = map.rowToAttendee(r);
      return {
        ...attendee,
        lead_fields: attendee.lead_fields?.length
          ? attendee.lead_fields
          : attendeeLeadFields[attendee.id] ?? [],
      };
    });

    state = {
      v: SEED_VERSION,
      session: {
        user_id: me ? String(me.id) : null,
        selected_event_id: loadSelectedEvent() ?? (events[0] ? String(events[0].id) : null),
      },
      workspace: {
        id: workspaceId,
        name: ws ? String(ws.name) : "Workspace",
        timezone: ws ? String(ws.timezone) : "(GMT-3) São Paulo",
      },
      members: memberRows.map(map.rowToMember),
      events: events.map(map.rowToEvent),
      attendees,
      tasks: ((tasksR.data ?? []) as Row[]).map((r) => map.rowToTask(r, attByTask.get(String(r.id)))),
      categories: ((catsR.data ?? []) as Row[]).map(map.rowToCategory),
      transactions: ((txR.data ?? []) as Row[]).map(map.rowToTransaction),
      templates: ((tplR.data ?? []) as Row[]).map(map.rowToTemplate),
      activity: ((actR.data ?? []) as Row[]).map(map.rowToActivity),
      ingestEndpoints: ((ingestR.data ?? []) as Row[]).map(map.rowToIngestEndpoint),
      settings,
    };
  } catch (e) {
    console.error("[db] hidratação falhou:", e);
  } finally {
    hydrated = true;
    hydrating = false;
    emit();
  }
}

/** Força recarregar o workspace do servidor (login, reset). */
export async function rehydrate() {
  hydrated = false;
  hydrating = false;
  workspaceId = null;
  await hydrate();
}

/** Logout: limpa o estado em memória e volta ao seed neutro (o signOut é da UI). */
export function clearSession() {
  workspaceId = null;
  saveSelectedEvent(null);
  state = seedState();
  state.session.user_id = null;
  emit();
}

/**
 * Restaura o workspace demo do zero (Config → zona de perigo): apaga os dados
 * do workspace atual e re-semeia, mantendo o usuário logado como owner.
 */
export async function resetDemo() {
  if (!workspaceId) return;
  const supabase = client();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // events em cascata derruba attendees/tasks/task_attachments/transactions.
  for (const t of ["events", "budget_categories", "members", "activity", "checklist_templates"]) {
    await supabase.from(t).delete().eq("workspace_id", workspaceId);
  }
  await seedWorkspace(
    supabase as Parameters<typeof seedWorkspace>[0],
    workspaceId,
    user.id,
    displayNameFromUser(user),
    user.email ?? ""
  );
  await rehydrate();
}

/** Auto-save já roda a cada mutação; mantido para o botão "Salvar" da UI. */
export function saveNow(): boolean {
  saveSettings();
  return true;
}

export type { DbState };
