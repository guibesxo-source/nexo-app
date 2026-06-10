// Tipos de domínio do Nexo. Quando o schema do Supabase existir,
// types/database.ts será gerado via `supabase gen types` e estes tipos
// passarão a derivar das tabelas (docs/05 no repo do protótipo).

export type Workspace = {
  id: string;
  name: string;
};

export type Event = {
  id: string;
  workspace_id: string;
  name: string;
  starts_at: string;
  status: "draft" | "published" | "done";
};
