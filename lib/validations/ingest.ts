import { z } from "zod";

// Borda do route /api/ingest/hubspot — valida o payload que a LP envia no envio
// do formulário. Tolerante de propósito: o embed do HubSpot pode mandar `fields`
// como array {name,value} (leitura do DOM) ou como objeto plano { campo: valor }.

const fieldPair = z.object({
  name: z.string().trim().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const ingestRequestSchema = z.object({
  token: z.string().trim().min(8, "Token inválido"),
  fields: z.union([z.array(fieldPair), z.record(z.string(), z.unknown())]),
  submittedAt: z.union([z.string(), z.number()]).optional(),
  pageUrl: z.string().optional(),
  pageName: z.string().optional(),
  // Ping de diagnóstico disparado pelo próprio app ("Testar conexão"): valida o
  // token/endpoint sem gravar inscrito nem mexer nas estatísticas.
  test: z.boolean().optional(),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

/** Normaliza `fields` (array {name,value} OU objeto plano) para pares limpos. */
export function normalizeFields(
  fields: IngestRequest["fields"]
): Array<{ name: string; value: string }> {
  const toText = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "Sim" : "Não";
    if (typeof v === "string" || typeof v === "number") return String(v).trim();
    return "";
  };
  const pairs = Array.isArray(fields)
    ? fields.map((f) => ({ name: String(f.name).trim(), value: toText(f.value) }))
    : Object.entries(fields).map(([name, value]) => ({ name: name.trim(), value: toText(value) }));
  return pairs.filter((f) => f.name);
}
