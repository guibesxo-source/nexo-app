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

/** Fase do checklist em relação ao evento: antes, no dia, depois. */
export type TaskPhase = "pre" | "durante" | "pos";

export type TxKind = "entrada" | "saida";

export type TxPayment = "pago" | "pendente" | "recebido";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

/**
 * Tipo de ingresso. Texto livre: preserva o nome real do ingresso vindo do
 * Sympla/CSV (ex.: "Furgão", "Carreta", "Lote 1"). "Geral"/"Pro"/"VIP" são só
 * presets do formulário manual e o fallback quando a origem não informa.
 */
export type TicketType = string;

export type EventFormat = "online" | "presencial" | "hibrido";

export type EventPriority = "alta" | "media" | "baixa";

export type LeadField = {
  key: string;
  label: string;
  value: string;
  source?: "sympla" | "hubspot" | "csv" | "manual" | null;
  group?: "lead" | "ticket" | "order" | "custom" | null;
};

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
  /** Foto de perfil (data URL comprimido); ausente = mostra as iniciais. */
  avatar?: string | null;
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
  /** Origem externa do registro, quando veio de uma integracao. */
  external_source?: "sympla" | "hubspot" | "csv" | null;
  /** ID estavel na origem externa (ex.: ingresso/participante do Sympla). */
  external_id?: string | null;
  /** Campos extras do lead vindos de formularios/integracoes. */
  lead_fields?: LeadField[];
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
  /** Fase do evento; ausente em tarefas antigas — derivada do prazo via phaseOf. */
  phase?: TaskPhase;
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
  /** Fase do evento; se ausente, é derivada de offset_days ao aplicar o template. */
  phase?: TaskPhase;
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

/* ---------- Dashboard customizável (FR pós-MVP) ---------- */

/** Tipos de widget do dashboard. "kpi" referencia uma métrica (catálogo ou custom). */
export type DashboardWidgetType =
  | "kpi"
  | "chart-signups"
  | "chart-confirm"
  | "chart-category"
  | "block-cost"
  | "list-insights"
  | "list-activity"
  | "list-progress";

export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  /** Para "kpi": chave da métrica do catálogo OU id de uma métrica personalizada. */
  metric?: string;
  /** Largura em colunas numa grade de 4 (1–4). */
  span?: number;
  /**
   * Para "kpi": chaves de métricas (catálogo ou custom) exibidas como mini
   * estatísticas na lateral do card, ao lado do número principal. Até 3.
   */
  sideMetrics?: string[];
};

export type CustomMetricSource = "inscritos" | "financeiro" | "checklist";
export type CustomMetricAgg = "count" | "sum";
export type CustomMetricFormat = "number" | "money" | "percent";

/** Métrica definida pelo usuário: base de dados + filtro + agregação. */
export type CustomMetric = {
  id: string;
  label: string;
  source: CustomMetricSource;
  agg: CustomMetricAgg;
  /** Filtro dependente da source (status do inscrito / tipo da transação / status da tarefa). */
  filter?: string;
  icon?: string;
  format?: CustomMetricFormat;
};

export type DashboardConfig = {
  widgets: DashboardWidget[];
  customMetrics: CustomMetric[];
};

export type SymplaEventLink = {
  sympla_event_id: string;
  sympla_event_name?: string;
  linked_at: string;
  last_sync_at?: string;
  last_remote_count?: number;
  last_imported_count?: number;
  last_invalid_count?: number;
  /** Campos extras escolhidos pelo usuario para sincronizar deste evento. */
  field_keys?: string[];
};

export type EventFileCategory =
  | "midia-kit"
  | "criativos"
  | "fotos"
  | "briefing"
  | "metas"
  | "off"
  | "documento"
  | "outro";

/** Arquivo/recurso de um evento: um link na nuvem (Drive, Dropbox, Figma…) ou
   um upload pequeno (data URL). Persistido no blob de settings (app_settings). */
export type EventFile = {
  id: string;
  event_id: string;
  category: EventFileCategory;
  title: string;
  /** Link na nuvem do arquivo (preferido). */
  url?: string | null;
  /** Upload pequeno embutido (nome + data URL), alternativa ao link. */
  file?: { name: string; data: string } | null;
  note?: string | null;
  created_at: string;
};

export type AppSettings = {
  toggles: Record<string, boolean>;
  /** Token da API pública do Sympla (integração de importação de inscritos). */
  sympla_token?: string | null;
  /** Vínculos evento Nexo -> evento Sympla para sync automático. */
  sympla_event_links?: Record<string, SymplaEventLink>;
  /** Private App token do HubSpot (portal pessoal do Nexo) para importar inscritos. */
  hubspot_token?: string | null;
  /** API token pessoal do ClickUp (pk_…) para importar tarefas ao checklist. */
  clickup_token?: string | null;
  /** Sidebar recolhida (só ícones) — preferência por workspace/navegador. */
  sidebar_collapsed?: boolean;
  /** Layout do dashboard; ausente/null = usa o DEFAULT_DASHBOARD. */
  dashboard?: DashboardConfig | null;
  /** Fallback temporario para campos extras de inscritos enquanto a coluna jsonb nao existe no banco atual. */
  attendee_lead_fields?: Record<string, LeadField[]>;
  /** Últimas buscas do overlay de busca global (mais recente primeiro). */
  recent_searches?: string[];
  /** Notas do usuário por dia no calendário (chave = "YYYY-MM-DD"). */
  day_notes?: Record<string, string>;
  /** Arquivos/recursos por evento (mídia kit, fotos, briefing, metas) — chave = event_id. */
  event_files?: Record<string, EventFile[]>;
  /** Campos visíveis no painel "Dados do lead" (chaves de lead_fields). Vazio/ausente = todos. */
  lead_panel_fields?: string[];
};

export type Session = {
  user_id: string | null;
  selected_event_id: string | null;
};
