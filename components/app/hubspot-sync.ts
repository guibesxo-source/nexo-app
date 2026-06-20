"use client";

/* Estado do botão manual "Atualizar" da tela de Inscritos para eventos com
   webhook do HubSpot. Diferente do Sympla (que tem API pra puxar), aqui NÃO há
   nada pra consultar no HubSpot: o webhook já empurrou os inscritos pro banco;
   "atualizar" = reler os inscritos do Supabase. A atualização CONTÍNUA (Realtime
   + polling + foco) roda global no AppShell via useLiveAttendees — este hook só
   expõe o disparo manual e se o evento tem endpoint ativo. */
import { useState } from "react";
import { refreshAttendees, useDb } from "@/lib/db";

export function useHubspotAutoRefresh(eventId: string | null) {
  const db = useDb();
  const active =
    !!eventId && db.ingestEndpoints.some((e) => e.event_id === eventId && e.provider === "hubspot");
  const [busy, setBusy] = useState(false);

  const refreshNow = async () => {
    setBusy(true);
    try {
      return await refreshAttendees();
    } finally {
      setBusy(false);
    }
  };

  return { active, busy, refreshNow };
}
