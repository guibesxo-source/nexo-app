"use client";

import { useCallback, useEffect, useState } from "react";
import {
  setSymplaEventLink,
  syncAttendees,
  useDb,
  type AttendeeImportResult,
} from "@/lib/db";
import {
  orderUtm,
  symplaParticipantsToDrafts,
  type SymplaParticipant,
} from "@/lib/integrations/sympla";

type SymplaApiResponse = { data?: unknown[]; error?: string };

export type SymplaSyncResult = AttendeeImportResult & {
  remote: number;
  invalid: number;
};

export async function callSympla(body: Record<string, string>): Promise<unknown[]> {
  const res = await fetch("/api/sympla", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as SymplaApiResponse | null;
  if (!res.ok || !json?.data) throw new Error(json?.error ?? "Falha ao falar com o Sympla");
  return json.data;
}

/** Pedidos do evento (carregam o UTM, ausente nos participantes). Best-effort:
   se o endpoint falhar, devolve [] e o sync segue sem UTM. */
async function loadSymplaOrders(token: string, symplaEventId: string): Promise<Record<string, unknown>[]> {
  try {
    return (await callSympla({ resource: "orders", token, eventId: symplaEventId })) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

export async function loadSymplaParticipants(
  token: string,
  symplaEventId: string
): Promise<SymplaParticipant[]> {
  const [participants, orders] = await Promise.all([
    callSympla({ resource: "participants", token, eventId: symplaEventId }) as Promise<SymplaParticipant[]>,
    loadSymplaOrders(token, symplaEventId),
  ]);

  // Cruza o UTM do pedido em cada participante (por order_id).
  const utmByOrder = new Map<string, Record<string, string>>();
  for (const order of orders) {
    const id = String(order.id ?? order.order_id ?? "");
    if (!id) continue;
    const utm = orderUtm(order);
    if (Object.keys(utm).length) utmByOrder.set(id, utm);
  }
  if (utmByOrder.size === 0) return participants;

  return participants.map((p) => {
    const orderId = String(p.order_id ?? p.order?.id ?? "");
    const utm = orderId ? utmByOrder.get(orderId) : undefined;
    return utm ? { ...p, utm } : p;
  });
}

export function syncSymplaParticipants({
  eventId,
  symplaEventId,
  symplaEventName,
  participants,
  fieldKeys,
}: {
  eventId: string;
  symplaEventId: string;
  symplaEventName?: string;
  participants: SymplaParticipant[];
  fieldKeys?: string[];
}): Promise<SymplaSyncResult> {
  const { drafts, invalid } = symplaParticipantsToDrafts(participants, symplaEventId, fieldKeys);
  const result = syncAttendees(eventId, drafts);

  setSymplaEventLink(eventId, {
    sympla_event_id: symplaEventId,
    sympla_event_name: symplaEventName,
    last_sync_at: new Date().toISOString(),
    last_remote_count: participants.length,
    last_imported_count: drafts.length,
    last_invalid_count: invalid,
    field_keys: fieldKeys,
  });

  return Promise.resolve({ ...result, remote: participants.length, invalid });
}

export async function syncSymplaEvent({
  eventId,
  symplaEventId,
  symplaEventName,
  token,
  fieldKeys,
}: {
  eventId: string;
  symplaEventId: string;
  symplaEventName?: string;
  token: string;
  fieldKeys?: string[];
}): Promise<SymplaSyncResult> {
  const participants = await loadSymplaParticipants(token, symplaEventId);
  return syncSymplaParticipants({
    eventId,
    symplaEventId,
    symplaEventName,
    participants,
    fieldKeys,
  });
}

export function useSymplaAutoSync(eventId: string | null, intervalMs = 60000) {
  const db = useDb();
  const token = db.settings.sympla_token ?? "";
  const link = eventId ? db.settings.sympla_event_links?.[eventId] : undefined;
  const linkEventId = link?.sympla_event_id;
  const linkEventName = link?.sympla_event_name;
  const linkFieldKeys = link?.field_keys;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<SymplaSyncResult | null>(null);

  const syncNow = useCallback(async () => {
    if (!eventId || !token || !linkEventId) return null;
    setBusy(true);
    setError("");
    try {
      const result = await syncSymplaEvent({
        eventId,
        token,
        symplaEventId: linkEventId,
        symplaEventName: linkEventName,
        fieldKeys: linkFieldKeys,
      });
      setLastResult(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao sincronizar Sympla";
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, [eventId, linkEventId, linkEventName, linkFieldKeys, token]);

  useEffect(() => {
    if (!eventId || !token || !linkEventId) return;
    const first = window.setTimeout(() => { void syncNow(); }, 1500);
    const timer = window.setInterval(() => { void syncNow(); }, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [eventId, intervalMs, linkEventId, syncNow, token]);

  return { link, busy, error, lastResult, syncNow };
}
