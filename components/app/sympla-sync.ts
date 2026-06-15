"use client";

import { useCallback, useEffect, useState } from "react";
import {
  setSymplaEventLink,
  syncAttendees,
  useDb,
  type AttendeeImportResult,
} from "@/lib/db";
import {
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

export async function syncSymplaEvent({
  eventId,
  symplaEventId,
  symplaEventName,
  token,
}: {
  eventId: string;
  symplaEventId: string;
  symplaEventName?: string;
  token: string;
}): Promise<SymplaSyncResult> {
  const participants = (await callSympla({
    resource: "participants",
    token,
    eventId: symplaEventId,
  })) as SymplaParticipant[];
  const { drafts, invalid } = symplaParticipantsToDrafts(participants, symplaEventId);
  const result = syncAttendees(eventId, drafts);

  setSymplaEventLink(eventId, {
    sympla_event_id: symplaEventId,
    sympla_event_name: symplaEventName,
    last_sync_at: new Date().toISOString(),
    last_remote_count: participants.length,
    last_imported_count: drafts.length,
    last_invalid_count: invalid,
  });

  return { ...result, remote: participants.length, invalid };
}

export function useSymplaAutoSync(eventId: string | null, intervalMs = 60000) {
  const db = useDb();
  const token = db.settings.sympla_token ?? "";
  const link = eventId ? db.settings.sympla_event_links?.[eventId] : undefined;
  const linkEventId = link?.sympla_event_id;
  const linkEventName = link?.sympla_event_name;
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
  }, [eventId, linkEventId, linkEventName, token]);

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
