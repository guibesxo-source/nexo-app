// Tipos de domínio do Nexo, alinhados ao modelo de dados (docs/05 do repo
// do protótipo). Quando o schema do Supabase existir, types/database.ts será
// gerado via `supabase gen types` e estes tipos passarão a derivar das tabelas.
// `capacity` (events) e `ticket` (attendees) são extensões da UI sobre o DDL.

export type EventStatus =
  | "rascunho"
  | "planejamento"
  | "confirmado"
  | "encerrado"
  | "cancelado";

export type AttendeeStatus = "pendente" | "confirmado" | "checkin" | "cancelado";

export type TaskStatus = "aberta" | "concluida";

export type TxKind = "entrada" | "saida";

export type TxPayment = "pago" | "pendente" | "recebido";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export type TicketType = "Geral" | "Pro" | "VIP";

export type EventFormat = "online" | "presencial" | "hibrido";

export type EventPriority = "alta" | "media" | "baixa";

export type Workspace = {
  id: string;
  name: string;
  timezone: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: MemberRole;
  title: string; // função exibida no card (ex.: "Coordenadora")
  created_at: string;
};

export type Event = {
  id: string;
  name: string;
  status: EventStatus;
  starts_at: string; // ISO
  location: string;
  capacity: number;
  budget_planned: number;
  cover: string; // gradiente CSS do card
  format?: EventFormat; // online/presencial/híbrido — opcional, sugere template
  priority?: EventPriority; // alta/média/baixa — eventos antigos contam como média
  created_at: string;
};

export type Attendee = {
  id: string;
  event_id: string;
  name: string;
  email: string;
  company: string;
  ticket: TicketType;
  status: AttendeeStatus;
  created_at: string;
};

/** Anexo de tarefa (imagem ou arquivo) guardado como data URL na base local. */
export type TaskAttachment = {
  id: string;
  name: string;
  kind: "image" | "file";
  data: string; // data URL
  added_at: string;
};

export type Task = {
  id: string;
  event_id: string;
  title: string;
  group: string; // agrupamento do checklist (ex.: "Pré-produção")
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null; // ISO (só data)
  /** Detalhe da tarefa (texto livre: contexto, links, decisões). */
  description?: string;
  /** Imagens e arquivos anexados à tarefa. */
  attachments?: TaskAttachment[];
  /** Custo previsto da tarefa (R$) — diferencial: alimenta o Financeiro do evento. */
  cost_estimate?: number;
  /** Transação ligada no Financeiro quando o custo foi lançado. */
  finance_tx_id?: string | null;
  created_at: string;
};

export type BudgetCategory = {
  id: string;
  name: string;
  icon: string; // emoji exibido na linha de lançamento
};

export type Transaction = {
  id: string;
  event_id: string;
  category_id: string | null;
  kind: TxKind;
  description: string;
  amount: number; // sempre positivo; o sinal vem de `kind`
  payment_status: TxPayment;
  invoice_ref: string | null; // ex.: "NF #2241"
  /** Arquivo da NF anexado (data URL); opcional. */
  invoice_file?: { name: string; data: string } | null;
  /** Boleto anexado (data URL); opcional. */
  boleto_file?: { name: string; data: string } | null;
  occurred_on: string; // ISO (só data)
  created_at: string;
};

/** Item de um template de checklist: tarefa + grupo + prazo relativo opcional. */
export type ChecklistTemplateItem = {
  group: string;
  title: string;
  /** Dias relativos à data do evento: negativo = antes (D-14), positivo = depois (D+2). */
  offset_days?: number;
};

/** Template de checklist reutilizável (built-in genérico ou customizado do usuário). */
export type ChecklistTemplate = {
  id: string;
  name: string;
  format?: EventFormat;
  builtin?: boolean;
  items: ChecklistTemplateItem[];
};

export type Activity = {
  id: string;
  icon: string;
  /** Segmentos alternando texto normal/negrito, como no protótipo. */
  text: string[];
  created_at: string;
};

export type AppSettings = {
  toggles: Record<string, boolean>;
  /** Token da API pública do Sympla (integração de importação de inscritos). */
  sympla_token?: string | null;
  /** Últimas buscas do overlay de busca global (mais recente primeiro). */
  recent_searches?: string[];
};

export type Session = {
  user_id: string | null;
  selected_event_id: string | null;
};
