import { NextResponse } from "next/server";
import { hubspotRequestSchema } from "@/lib/validations/hubspot";

// Proxy da API do HubSpot (mesmo desenho do /api/sympla). O browser não chama
// direto (CORS) e o token de Private App não deve transitar em URL — o client
// manda { resource, token, ... } via POST e este handler pagina e devolve.
// Auth via Authorization: Bearer <Private App token do portal do Nexo>.
//
// Escopos necessários no Private App: `forms` (listar formulários e ler
// submissões). Para enriquecer com dados de contato, adicione também
// `crm.objects.contacts.read`.

const BASE = "https://api.hubapi.com";

type HubspotPage = {
  results?: unknown[];
  paging?: { next?: { after?: string } };
};

/** Segue o cursor `paging.next.after` do HubSpot até acabar ou bater maxPages. */
async function fetchAll(path: string, token: string, maxPages: number): Promise<unknown[]> {
  const all: unknown[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const cursor = after ? `&after=${encodeURIComponent(after)}` : "";
    const res = await fetch(`${BASE}${path}${sep}limit=50${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new Error("unauthorized");
    if (!res.ok) throw new Error("upstream");
    const body = (await res.json()) as HubspotPage;
    const items = Array.isArray(body.results) ? body.results : [];
    all.push(...items);
    after = body.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = hubspotRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { token } = parsed.data;
  try {
    const data =
      parsed.data.resource === "forms"
        ? await fetchAll("/marketing/v3/forms", token, 3)
        : await fetchAll(
            `/form-integrations/v1/submissions/forms/${encodeURIComponent(parsed.data.formId)}`,
            token,
            30
          );
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json(
        {
          error:
            "Token recusado pelo HubSpot — confira o Private App e os escopos (forms) no portal do Nexo.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível falar com o HubSpot agora. Tente de novo em instantes." },
      { status: 502 }
    );
  }
}
