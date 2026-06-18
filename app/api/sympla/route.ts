import { NextResponse } from "next/server";
import { symplaRequestSchema } from "@/lib/validations/sympla";

// Proxy da API pública do Sympla (api.sympla.com.br/public/v3). O browser não
// consegue chamá-la direto (CORS) e o token não deve transitar em URL — o
// client manda { resource, token } via POST e este handler pagina e devolve.

const BASE = "https://api.sympla.com.br/public/v3";

const PARTICIPANT_FIELDS = [
  "id",
  "event_id",
  "order_id",
  "order_status",
  "order_date",
  "order_updated_date",
  "order_approved_date",
  "order_discount",
  "first_name",
  "last_name",
  "full_name",
  "name",
  "email",
  "participant_email",
  "buyer_email",
  "company",
  "organization",
  "ticket_id",
  "ticket_number",
  "ticket_num",
  "ticket_num_qr_code",
  "ticket_created_at",
  "ticket_updated_at",
  "ticket_name",
  "sector_name",
  "marked_place_name",
  "access_information",
  "ticket_sale_price",
  "status",
  "checkin",
  "custom_form",
  // tracking de origem (quando o pedido carrega UTM) — o Sympla ignora os que não existem
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
].join(",");

type SymplaPage = {
  data?: unknown[];
  pagination?: { has_next?: boolean };
};

async function fetchAllPages(url: string, token: string, maxPages: number): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("page_size", "100");
    nextUrl.searchParams.set("page", String(page));
    const res = await fetch(nextUrl, {
      headers: { s_token: token },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new Error("unauthorized");
    if (!res.ok) throw new Error("upstream");
    const body = (await res.json()) as SymplaPage;
    const items = Array.isArray(body.data) ? body.data : [];
    all.push(...items);
    const hasNext = body.pagination?.has_next ?? items.length === 100;
    if (!hasNext) break;
  }
  return all;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = symplaRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { token } = parsed.data;
  try {
    const data =
      parsed.data.resource === "events"
        ? await fetchAllPages(`${BASE}/events`, token, 3)
        : parsed.data.resource === "orders"
          ? // Pedidos trazem o tracking de origem (UTM), ausente nos participantes.
            // Sem `fields` para vir o payload completo do pedido.
            await fetchAllPages(
              `${BASE}/events/${encodeURIComponent(parsed.data.eventId)}/orders?timezone=America%2FSao_Paulo`,
              token,
              100
            )
          : await fetchAllPages(
              `${BASE}/events/${encodeURIComponent(parsed.data.eventId)}/participants?fields=${encodeURIComponent(PARTICIPANT_FIELDS)}&field_sort=order_date&sort=DESC&timezone=America%2FSao_Paulo`,
              token,
              100
            );
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json(
        { error: "Token recusado pelo Sympla — confira em Minha conta → Integrações." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível falar com o Sympla agora. Tente de novo em instantes." },
      { status: 502 }
    );
  }
}
