import { NextResponse } from "next/server";
import { clickupRequestSchema } from "@/lib/validations/clickup";

// Proxy da API do ClickUp (api.clickup.com/api/v2) — mesmo desenho do
// /api/sympla e /api/hubspot. O browser não chama direto (CORS) e o token não
// deve transitar em URL. Auth via header Authorization: <Personal API Token>.
//
// Resources: teams → workspaces; spaces (de um team); folders (de um space);
// lists (de uma pasta, sem pasta, ou legado achatado); tasks (de uma list);
// task (um projeto/tarefa com subtarefas).

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
const FOLDERLESS_ID = "__folderless__";

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

    if (parsed.data.resource === "folders") {
      const sid = encodeURIComponent(parsed.data.spaceId);
      const [foldered, folderless] = await Promise.all([
        cuGet(`/space/${sid}/folder?archived=false`, token) as Promise<{ folders?: Named[] }>,
        cuGet(`/space/${sid}/list?archived=false`, token) as Promise<{ lists?: Named[] }>,
      ]);
      const folders: { id: string; name: string; folderless?: boolean }[] = [];
      for (const f of foldered.folders ?? []) {
        if (f.id != null) folders.push({ id: String(f.id), name: f.name ?? "Pasta" });
      }
      if ((folderless.lists ?? []).some((l) => l.id != null)) {
        folders.push({ id: FOLDERLESS_ID, name: "Sem pasta", folderless: true });
      }
      return NextResponse.json({ data: folders });
    }

    if (parsed.data.resource === "lists") {
      if (parsed.data.folderId) {
        if (parsed.data.folderId === FOLDERLESS_ID) {
          if (!parsed.data.spaceId) {
            return NextResponse.json({ error: "Informe o space" }, { status: 400 });
          }
          const body = (await cuGet(
            `/space/${encodeURIComponent(parsed.data.spaceId)}/list?archived=false`,
            token
          )) as { lists?: Named[] };
          const lists = (body.lists ?? [])
            .filter((l) => l.id != null)
            .map((l) => ({ id: String(l.id), name: l.name ?? "Projeto" }));
          return NextResponse.json({ data: lists });
        }

        const body = (await cuGet(
          `/folder/${encodeURIComponent(parsed.data.folderId)}/list?archived=false`,
          token
        )) as { lists?: Named[] };
        const lists = (body.lists ?? [])
          .filter((l) => l.id != null)
          .map((l) => ({ id: String(l.id), name: l.name ?? "Projeto" }));
        return NextResponse.json({ data: lists });
      }

      if (!parsed.data.spaceId) {
        return NextResponse.json({ error: "Informe o space ou a pasta" }, { status: 400 });
      }

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

    if (parsed.data.resource === "task") {
      const body = await cuGet(
        `/task/${encodeURIComponent(parsed.data.taskId)}?include_subtasks=true&include_markdown_description=true`,
        token
      );
      return NextResponse.json({ data: body });
    }

    const body = (await cuGet(
      `/list/${encodeURIComponent(parsed.data.listId)}/task?archived=false&include_closed=true&subtasks=false`,
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
