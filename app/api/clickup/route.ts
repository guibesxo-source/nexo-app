import { NextResponse } from "next/server";
import { clickupRequestSchema } from "@/lib/validations/clickup";

// Proxy da API do ClickUp (api.clickup.com/api/v2) — mesmo desenho do
// /api/sympla e /api/hubspot. O browser não chama direto (CORS) e o token não
// deve transitar em URL. Auth via header Authorization: <Personal API Token>.
//
// Resources: teams → workspaces; spaces (de um team); lists (folderless +
// dentro de folders de um space); tasks (de uma list).

const BASE = "https://api.clickup.com/api/v2";

async function cuGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new Error("unauthorized");
  if (!res.ok) throw new Error("upstream");
  return res.json();
}

type Named = { id?: string | number; name?: string };

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = clickupRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { token } = parsed.data;
  try {
    if (parsed.data.resource === "teams") {
      const body = (await cuGet("/team", token)) as { teams?: unknown[] };
      return NextResponse.json({ data: Array.isArray(body.teams) ? body.teams : [] });
    }

    if (parsed.data.resource === "spaces") {
      const body = (await cuGet(
        `/team/${encodeURIComponent(parsed.data.teamId)}/space?archived=false`,
        token
      )) as { spaces?: unknown[] };
      return NextResponse.json({ data: Array.isArray(body.spaces) ? body.spaces : [] });
    }

    if (parsed.data.resource === "lists") {
      const sid = encodeURIComponent(parsed.data.spaceId);
      // Listas soltas no space + listas dentro de folders, achatadas numa lista só.
      const [folderless, foldered] = await Promise.all([
        cuGet(`/space/${sid}/list?archived=false`, token) as Promise<{ lists?: Named[] }>,
        cuGet(`/space/${sid}/folder?archived=false`, token) as Promise<{
          folders?: { name?: string; lists?: Named[] }[];
        }>,
      ]);
      const lists: { id: string; name: string; folder?: string }[] = [];
      for (const l of folderless.lists ?? []) {
        if (l.id != null) lists.push({ id: String(l.id), name: l.name ?? "Lista" });
      }
      for (const f of foldered.folders ?? []) {
        for (const l of f.lists ?? []) {
          if (l.id != null) lists.push({ id: String(l.id), name: l.name ?? "Lista", folder: f.name });
        }
      }
      return NextResponse.json({ data: lists });
    }

    // tasks
    const body = (await cuGet(
      `/list/${encodeURIComponent(parsed.data.listId)}/task?archived=false&include_closed=true`,
      token
    )) as { tasks?: unknown[] };
    return NextResponse.json({ data: Array.isArray(body.tasks) ? body.tasks : [] });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json(
        {
          error:
            "Token recusado pelo ClickUp — confira o Personal API Token (pk_…) em Settings → Apps.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível falar com o ClickUp agora. Tente de novo em instantes." },
      { status: 502 }
    );
  }
}
