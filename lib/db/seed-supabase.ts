// Semeia um workspace recém-criado com os dados demo (seedState), escopados ao
// workspace_id e com uuids novos no lugar dos ids fixos ("e1","m1"...). Roda no
// servidor (rota de signup) com o client service role — ignora RLS de propósito.
// O member "owner" do seed assume a identidade real do usuário recém-criado.

import type { SupabaseClient } from "@supabase/supabase-js";
import { initialsOf } from "@/lib/format";
import { seedState } from "./seed";
import {
  activityToRow,
  attendeeToRow,
  categoryToRow,
  eventToRow,
  memberToRow,
  taskToRow,
  transactionToRow,
} from "./supabase-map";

const uuid = () => globalThis.crypto.randomUUID();

/** Mapa id-antigo → uuid-novo; cria a entrada na primeira vez que vê o id. */
function remapper() {
  const map = new Map<string, string>();
  return (oldId: string | null | undefined): string | null => {
    if (!oldId) return null;
    let v = map.get(oldId);
    if (!v) {
      v = uuid();
      map.set(oldId, v);
    }
    return v;
  };
}

export async function seedWorkspace(
  admin: SupabaseClient,
  workspaceId: string,
  ownerProfileId: string,
  ownerName: string,
  ownerEmail: string
): Promise<{ error: string | null }> {
  const seed = seedState();

  const memberId = remapper();
  const eventId = remapper();
  const categoryId = remapper();
  const txId = remapper();
  const taskId = remapper();

  // Membros — o owner do seed vira o usuário real (com profile).
  const memberRows = seed.members.map((m) => {
    const id = memberId(m.id)!;
    const isOwner = m.role === "owner";
    const member = isOwner
      ? { ...m, id, name: ownerName, email: ownerEmail, initials: initialsOf(ownerName) }
      : { ...m, id };
    return memberToRow(workspaceId, member, isOwner ? ownerProfileId : null);
  });

  const categoryRows = seed.categories.map((c) =>
    categoryToRow(workspaceId, { ...c, id: categoryId(c.id)! })
  );

  const eventRows = seed.events.map((e) =>
    eventToRow(workspaceId, { ...e, id: eventId(e.id)! })
  );

  const attendeeRows = seed.attendees.map((a) =>
    attendeeToRow(workspaceId, { ...a, id: uuid(), event_id: eventId(a.event_id)! })
  );

  const taskRows = seed.tasks.map((t) =>
    taskToRow(workspaceId, {
      ...t,
      id: taskId(t.id)!,
      event_id: eventId(t.event_id)!,
      assignee_id: memberId(t.assignee_id),
      finance_tx_id: t.finance_tx_id ? txId(t.finance_tx_id) : null,
    })
  );

  const txRows = seed.transactions.map((x) =>
    transactionToRow(workspaceId, {
      ...x,
      id: txId(x.id)!,
      event_id: eventId(x.event_id)!,
      category_id: x.category_id ? categoryId(x.category_id) : null,
    })
  );

  const activityRows = seed.activity.map((a) => activityToRow(workspaceId, { ...a, id: uuid() }));

  // Ordem segura para as FKs: members/categories → events → attendees/tasks/transactions.
  const steps: [string, Row[]][] = [
    ["members", memberRows],
    ["budget_categories", categoryRows],
    ["events", eventRows],
    ["attendees", attendeeRows],
    ["tasks", taskRows],
    ["transactions", txRows],
    ["activity", activityRows],
  ];

  for (const [table, rows] of steps) {
    if (!rows.length) continue;
    const { error } = await admin.from(table).insert(rows as never);
    if (error) return { error: `seed ${table}: ${error.message}` };
  }

  // upsert: torna o reset (Config → restaurar demo) idempotente
  const { error: settingsErr } = await admin
    .from("app_settings")
    .upsert({ workspace_id: workspaceId, data: seed.settings } as never, {
      onConflict: "workspace_id",
    });
  if (settingsErr) return { error: `seed app_settings: ${settingsErr.message}` };

  return { error: null };
}

type Row = Record<string, unknown>;
