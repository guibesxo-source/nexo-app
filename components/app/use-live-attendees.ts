"use client";

/* Mantém os inscritos VIVOS em todo o app (dashboard incluso), sem o usuário
   precisar atualizar na mão. Montado uma única vez no AppShell — não depende da
   tela de Inscritos estar aberta.

   Enquanto existir ao menos um endpoint de recebimento (webhook do formulário):
   1) Realtime do Supabase: cada INSERT em `attendees` do workspace dispara uma
      releitura na hora (instantâneo). Requer a migration 0003 (publication).
   2) Fallback de polling: relê a cada POLL_MS — cobre Realtime desabilitado ou
      queda de conexão, garantindo que sempre atualize sozinho.
   3) Ao voltar o foco para a aba/janela, atualiza imediatamente. */
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { refreshAttendees, refreshIngestEndpoints, useDb } from "@/lib/db";

const POLL_MS = 20000;

export function useLiveAttendees() {
  const db = useDb();
  const workspaceId = db.workspace?.id ?? null;
  // Só liga quando o recurso está em uso (há endpoint de webhook no workspace).
  const live = db.ingestEndpoints.length > 0;

  useEffect(() => {
    if (!live || !workspaceId) return;

    let disposed = false;
    let debounce: number | undefined;
    const supabase = createClient();

    // Agrupa rajadas de inserts numa única releitura.
    const refresh = () => {
      if (disposed) return;
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void refreshAttendees();
        void refreshIngestEndpoints();
      }, 400);
    };

    // 1) Realtime: INSERT em attendees do workspace → releitura imediata.
    const channel = supabase
      .channel(`attendees:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendees", filter: `workspace_id=eq.${workspaceId}` },
        refresh
      )
      .subscribe();

    // 2) Fallback: polling contínuo.
    const poll = window.setInterval(() => void refreshAttendees(), POLL_MS);

    // 3) Foco/visibilidade: atualiza ao voltar pra aba.
    const onFocus = () => {
      if (document.visibilityState !== "hidden") {
        void refreshAttendees();
        void refreshIngestEndpoints();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearTimeout(debounce);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [live, workspaceId]);
}
