"use client";

/* Mantém os inscritos do Sympla VIVOS em todo o app, sem o usuário abrir o
   evento e rodar a sincronização na mão. Montado uma única vez no AppShell —
   não depende da tela de Inscritos estar aberta.

   Diferente do HubSpot (o webhook EMPURRA pro banco e o useLiveAttendees só
   relê), o Sympla precisa ser PUXADO pela API. Então aqui o app percorre TODOS
   os eventos com vínculo Sympla e sincroniza sozinho:
   1) Intervalo contínuo (POLL_MS) — enquanto a aba estiver aberta.
   2) Ao voltar o foco para a aba/janela, sincroniza na hora.
   syncAttendees deduplica e só re-renderiza quando há novidade, então os números
   (sidebar, dashboard, lista) se atualizam sozinhos em qualquer view.

   Observação: roda no client, então cobre 24h enquanto houver uma aba do Nexo
   aberta. Sync 24/7 com o navegador fechado exige um cron no servidor (fase
   futura, com Supabase Edge Functions). */
import { useEffect } from "react";
import { useDb } from "@/lib/db";
import { getState } from "@/lib/db/store";
import { syncSymplaEvent } from "@/components/app/sympla-sync";

const POLL_MS = 60000;

type LinkedEvent = { eventId: string; symplaEventId: string; name?: string; fieldKeys?: string[] };

/** Lê do store (fresco) os eventos com vínculo Sympla + o token atual. */
function linkedSympla(): { token: string; events: LinkedEvent[] } {
  const s = getState();
  const token = s.settings.sympla_token ?? "";
  const links = s.settings.sympla_event_links ?? {};
  const events: LinkedEvent[] = Object.entries(links)
    .filter(([, link]) => link?.sympla_event_id)
    .map(([eventId, link]) => ({
      eventId,
      symplaEventId: link.sympla_event_id,
      name: link.sympla_event_name,
      fieldKeys: link.field_keys,
    }));
  return { token, events };
}

export function useLiveSympla() {
  const db = useDb();
  const token = db.settings.sympla_token ?? "";
  // Assinatura estável do conjunto de vínculos: muda quando o usuário vincula,
  // desvincula ou troca os campos de um evento — só então reinicia o ciclo.
  const sig = Object.entries(db.settings.sympla_event_links ?? {})
    .filter(([, link]) => link?.sympla_event_id)
    .map(([eventId, link]) => `${eventId}:${link.sympla_event_id}:${(link.field_keys ?? []).join(",")}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!token || !sig) return;

    let disposed = false;
    let running = false;

    // Sincroniza os eventos em sequência; um erro num evento não derruba os
    // outros. Guarda contra execuções sobrepostas (poll + foco ao mesmo tempo).
    const syncAll = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const { token: liveToken, events } = linkedSympla();
        if (!liveToken) return;
        for (const ev of events) {
          if (disposed) break;
          try {
            await syncSymplaEvent({
              eventId: ev.eventId,
              token: liveToken,
              symplaEventId: ev.symplaEventId,
              symplaEventName: ev.name,
              fieldKeys: ev.fieldKeys,
            });
          } catch {
            // segue para o próximo evento
          }
        }
      } finally {
        running = false;
      }
    };

    const first = window.setTimeout(() => void syncAll(), 1500);
    const timer = window.setInterval(() => void syncAll(), POLL_MS);
    const onFocus = () => {
      if (document.visibilityState !== "hidden") void syncAll();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, sig]);
}
