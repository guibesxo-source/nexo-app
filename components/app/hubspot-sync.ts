"use client";

/* Auto-atualização de inscritos para eventos com webhook do HubSpot. Diferente
   do Sympla (que tem API pra puxar de tempo em tempo), aqui NÃO há nada pra
   consultar no HubSpot: o webhook já empurrou os inscritos pro nosso banco.
   Então "sincronizar" = reler os inscritos do Supabase — num intervalo e no
   botão manual. Só roda quando o evento selecionado tem um endpoint ativo. */
import { useCallback, useEffect, useState } from "react";
import { refreshAttendees, useDb } from "@/lib/db";

export function useHubspotAutoRefresh(eventId: string | null, intervalMs = 60000) {
  const db = useDb();
  const active =
    !!eventId && db.ingestEndpoints.some((e) => e.event_id === eventId && e.provider === "hubspot");
  const [busy, setBusy] = useState(false);

  const refreshNow = useCallback(async () => {
    setBusy(true);
    try {
      return await refreshAttendees();
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshAttendees();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);

  return { active, busy, refreshNow };
}
