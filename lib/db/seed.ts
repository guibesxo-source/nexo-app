// Seed do workspace demo — os dados do protótipo (lib/demo-data.ts, aposentado)
// convertidos para o modelo de dados real (docs/05). O workspace nasce populado
// para o app não abrir vazio; tudo é editável e persiste no navegador.
// Quando o Supabase existir, este seed vira fixture de desenvolvimento.

import type {
  Activity,
  AppSettings,
  Attendee,
  AttendeeStatus,
  BudgetCategory,
  ChecklistTemplate,
  Event,
  IngestEndpoint,
  Member,
  Session,
  Task,
  TaskPhase,
  TicketType,
  Transaction,
  Workspace,
} from "@/types";

export const SEED_VERSION = 2;

export type DbState = {
  v: number;
  session: Session;
  workspace: Workspace;
  members: Member[];
  events: Event[];
  attendees: Attendee[];
  tasks: Task[];
  categories: BudgetCategory[];
  transactions: Transaction[];
  /** Templates de checklist customizados do usuário (built-ins vivem em actions.ts). */
  templates: ChecklistTemplate[];
  activity: Activity[];
  /** Endpoints de webhook por evento (recebem inscritos de formulários externos). */
  ingestEndpoints: IngestEndpoint[];
  settings: AppSettings;
};

const workspace: Workspace = {
  id: "w1",
  name: "Nexo Events Co.",
  timezone: "(GMT-3) São Paulo",
};

const members: Member[] = [
  { id: "m1", name: "Lucas Ferraz", email: "lucas@nexo.events", initials: "LF", role: "owner", title: "Produtor", created_at: "2026-04-01T09:00:00" },
  { id: "m2", name: "Mariana Costa", email: "mariana@nexo.events", initials: "MC", role: "admin", title: "Coordenadora", created_at: "2026-04-02T09:00:00" },
  { id: "m3", name: "Diego Almeida", email: "diego@nexo.events", initials: "DA", role: "member", title: "Produção", created_at: "2026-04-03T09:00:00" },
  { id: "m4", name: "Rafael Pereira", email: "rafael@nexo.events", initials: "RP", role: "member", title: "Marketing", created_at: "2026-04-04T09:00:00" },
  { id: "m5", name: "Carolina Lima", email: "carolina@nexo.events", initials: "CL", role: "member", title: "Comunicação", created_at: "2026-04-05T09:00:00" },
  { id: "m6", name: "Pedro Rocha", email: "pedro@nexo.events", initials: "PR", role: "member", title: "Logística", created_at: "2026-04-06T09:00:00" },
];

const events: Event[] = [
  { id: "e1", name: "Summit de Marketing 2026", status: "confirmado", starts_at: "2026-06-18T09:00:00", location: "São Paulo", capacity: 400, budget_planned: 180000, cover: "linear-gradient(135deg,#00B863,#0A0A0A)", created_at: "2026-03-10T10:00:00" },
  { id: "e2", name: "Festival Sonora", status: "planejamento", starts_at: "2026-07-22T16:00:00", location: "Rio de Janeiro", capacity: 3000, budget_planned: 650000, cover: "linear-gradient(135deg,#7C3AED,#0A0A0A)", created_at: "2026-03-22T10:00:00" },
  { id: "e3", name: "Workshop UX Lab", status: "confirmado", starts_at: "2026-07-03T14:00:00", location: "Online", capacity: 120, budget_planned: 24000, cover: "linear-gradient(135deg,#0EA5E9,#0A0A0A)", created_at: "2026-04-12T10:00:00" },
  { id: "e4", name: "Conferência DevBR", status: "rascunho", starts_at: "2026-08-19T09:00:00", location: "Belo Horizonte", capacity: 800, budget_planned: 320000, cover: "linear-gradient(135deg,#1A1A1A,#444)", created_at: "2026-05-02T10:00:00" },
  { id: "e5", name: "Encontro de Líderes", status: "confirmado", starts_at: "2026-09-12T08:30:00", location: "Curitiba", capacity: 200, budget_planned: 95000, cover: "linear-gradient(135deg,#0891B2,#0A0A0A)", created_at: "2026-05-10T10:00:00" },
  { id: "e6", name: "Gala de Premiação", status: "planejamento", starts_at: "2026-11-30T19:00:00", location: "São Paulo", capacity: 500, budget_planned: 280000, cover: "linear-gradient(135deg,#B45309,#0A0A0A)", created_at: "2026-05-20T10:00:00" },
];

// Inscritos do evento principal (e1) — nomes do protótipo + complemento
// gerado, com datas espalhadas pelas últimas semanas (alimenta o gráfico).
type SeedPerson = [name: string, email: string, company: string, ticket: TicketType, status: AttendeeStatus, createdAt: string];

const E1_PEOPLE: SeedPerson[] = [
  ["Mariana Souza", "mariana@octopus.io", "Octopus Studio", "VIP", "confirmado", "2026-06-02T14:32:00"],
  ["Rafael Martins", "rafael@brand.co", "Brand & Co.", "Pro", "checkin", "2026-05-30T09:17:00"],
  ["Júlia Santos", "julia@hubinc.com", "Hub Inc.", "Geral", "pendente", "2026-06-05T11:08:00"],
  ["Diego Andrade", "diego@nexus.ai", "Nexus AI", "VIP", "confirmado", "2026-06-04T16:44:00"],
  ["Carolina Dias", "caro@summit.co", "Summit.co", "Pro", "confirmado", "2026-06-01T10:22:00"],
  ["Pedro Barros", "pedro@brava.studio", "Brava Studio", "Geral", "pendente", "2026-06-06T08:55:00"],
  ["Larissa Melo", "larissa@conecta.com", "Conecta", "Pro", "confirmado", "2026-05-29T19:03:00"],
  ["Thiago Souza", "thiago@ativa.io", "Ativa", "VIP", "checkin", "2026-05-28T13:47:00"],
  ["Ana Ferreira", "ana@palco.live", "Palco Live", "Geral", "confirmado", "2026-06-03T21:12:00"],
  ["Vitor Gomes", "vitor@hubevents.com", "Hub Events", "Geral", "pendente", "2026-06-06T07:30:00"],
  ["Beatriz Nunes", "bia@studioma.com", "Studio MA", "Pro", "confirmado", "2026-05-26T10:05:00"],
  ["Gustavo Reis", "gustavo@vortex.dev", "Vortex", "Geral", "confirmado", "2026-05-24T15:40:00"],
  ["Helena Prado", "helena@onda.tv", "Onda TV", "VIP", "confirmado", "2026-05-21T09:12:00"],
  ["Igor Tavares", "igor@pulso.fm", "Pulso FM", "Geral", "pendente", "2026-05-19T17:25:00"],
  ["Camila Rocha", "camila@lumen.co", "Lumen", "Pro", "confirmado", "2026-05-15T11:50:00"],
  ["Bruno Aguiar", "bruno@kraft.com.br", "Kraft Eventos", "Geral", "confirmado", "2026-05-12T14:08:00"],
  ["Renata Lopes", "renata@vivaz.io", "Vivaz", "Geral", "confirmado", "2026-05-07T10:33:00"],
  ["Felipe Cardoso", "felipe@orbi.app", "Orbi", "Pro", "confirmado", "2026-05-05T16:20:00"],
  ["Sofia Mendes", "sofia@artefato.cc", "Artefato", "Geral", "pendente", "2026-04-29T09:45:00"],
  ["Marcelo Pinto", "marcelo@base44.com", "Base44", "Geral", "confirmado", "2026-04-27T13:15:00"],
  ["Patrícia Freitas", "pati@elo.events", "Elo Eventos", "VIP", "confirmado", "2026-04-23T18:02:00"],
  ["Eduardo Ramos", "edu@matriz.co", "Matriz", "Geral", "confirmado", "2026-04-21T08:40:00"],
];

const OTHER_PEOPLE: [eventId: string, ...SeedPerson][] = [
  ["e2", "Luana Castro", "luana@sonar.fm", "Sonar FM", "Geral", "confirmado", "2026-05-18T10:00:00"],
  ["e2", "Caio Brito", "caio@palcomix.com", "PalcoMix", "Geral", "pendente", "2026-05-25T12:00:00"],
  ["e2", "Nina Duarte", "nina@vibe.live", "Vibe Live", "Pro", "confirmado", "2026-06-01T15:30:00"],
  ["e3", "Otávio Luz", "otavio@uxlab.cc", "UX Lab", "Geral", "confirmado", "2026-05-28T09:00:00"],
  ["e3", "Paula Viana", "paula@figmatica.co", "Figmática", "Geral", "confirmado", "2026-06-02T10:15:00"],
  ["e3", "Saulo Pires", "saulo@designop.io", "DesignOps BR", "Pro", "pendente", "2026-06-05T17:45:00"],
  ["e5", "Tereza Brandão", "tereza@cumeagro.com", "Cume Agro", "VIP", "confirmado", "2026-05-30T08:00:00"],
  ["e5", "Vicente Mota", "vicente@altavista.co", "Alta Vista", "Geral", "pendente", "2026-06-03T11:20:00"],
];

const attendees: Attendee[] = [
  ...E1_PEOPLE.map(([name, email, company, ticket, status, created_at], i): Attendee => ({
    id: `a${i + 1}`, event_id: "e1", name, email, company, ticket, status, created_at,
  })),
  ...OTHER_PEOPLE.map(([event_id, name, email, company, ticket, status, created_at], i): Attendee => ({
    id: `b${i + 1}`, event_id, name, email, company, ticket, status, created_at,
  })),
];

// Checklist do evento principal (grupos do protótipo, datas reais).
type SeedTask = [title: string, group: string, assignee: string | null, due: string | null, done: boolean];

const E1_TASKS: SeedTask[] = [
  ["Definir escopo e objetivo do evento", "Pré-produção", "m1", "2026-05-12", true],
  ["Fechar contrato com o local (WTC)", "Pré-produção", "m3", "2026-05-20", true],
  ["Aprovar orçamento com a diretoria", "Pré-produção", "m1", "2026-05-22", true],
  ["Contratar fornecedor de catering", "Pré-produção", "m2", "2026-06-12", false],
  ["Publicar página de inscrição", "Marketing & Inscrições", "m4", "2026-05-15", true],
  ["Lançar campanha de mídia paga", "Marketing & Inscrições", "m4", "2026-05-25", true],
  ["Enviar save-the-date", "Marketing & Inscrições", "m5", "2026-06-04", false],
  ["Confirmar lista de palestrantes", "Marketing & Inscrições", "m2", "2026-06-09", false],
  ["Preparar kit de imprensa", "Marketing & Inscrições", "m5", "2026-06-13", false],
  ["Testar equipamentos de A/V", "Produção", "m6", "2026-06-08", false],
  ["Imprimir crachás e sinalização", "Produção", "m6", "2026-06-15", false],
  ["Montar cronograma operacional", "Produção", "m3", "2026-06-14", false],
  ["Briefing com a equipe de staff", "Dia do evento", "m1", "2026-06-18", false],
  ["Abrir credenciamento e recepção", "Dia do evento", "m6", "2026-06-18", false],
  ["Coordenar palco e cronograma ao vivo", "Dia do evento", "m3", "2026-06-18", false],
  ["Compilar relatório de resultados", "Pós-evento", "m1", "2026-06-20", false],
  ["Enviar pesquisa de satisfação (NPS)", "Pós-evento", "m5", "2026-06-19", false],
  ["Follow-up dos leads com vendas", "Pós-evento", "m4", "2026-06-22", false],
];

// Fase de cada grupo do checklist do e1 (pré/durante/pós).
const E1_GROUP_PHASE: Record<string, TaskPhase> = {
  "Pré-produção": "pre",
  "Marketing & Inscrições": "pre",
  "Produção": "pre",
  "Dia do evento": "durante",
  "Pós-evento": "pos",
};

const tasks: Task[] = [
  ...E1_TASKS.map(([title, group, assignee_id, due_date, done], i): Task => ({
    id: `t${i + 1}`, event_id: "e1", title, group, phase: E1_GROUP_PHASE[group] ?? "pre",
    assignee_id, due_date,
    status: done ? "concluida" : "aberta", created_at: "2026-05-02T09:00:00",
  })),
  { id: "t19", event_id: "e2", title: "Definir line-up principal", group: "Pré-produção", phase: "pre", status: "aberta", assignee_id: "m2", due_date: "2026-06-20", created_at: "2026-05-12T09:00:00" },
  { id: "t20", event_id: "e3", title: "Preparar material do workshop", group: "Pré-produção", phase: "pre", status: "aberta", assignee_id: "m5", due_date: "2026-06-25", created_at: "2026-05-15T09:00:00" },
];

const categories: BudgetCategory[] = [
  { id: "c1", name: "Local & Estrutura", icon: "🏢" },
  { id: "c2", name: "Marketing", icon: "📣" },
  { id: "c3", name: "Catering", icon: "🍽️" },
  { id: "c4", name: "Equipe & Cachês", icon: "🎤" },
  { id: "c5", name: "Produção", icon: "🖨️" },
  { id: "c6", name: "Patrocínio", icon: "💸" },
];

const transactions: Transaction[] = [
  { id: "x1", event_id: "e1", category_id: "c1", kind: "saida", description: "Centro de Convenções WTC", amount: 42000, payment_status: "pago", invoice_ref: "NF #2241", occurred_on: "2026-06-04", created_at: "2026-06-04T10:00:00" },
  { id: "x2", event_id: "e1", category_id: "c2", kind: "saida", description: "Campanha de mídia paga", amount: 12450, payment_status: "pago", invoice_ref: "NF #2238", occurred_on: "2026-06-03", created_at: "2026-06-03T10:00:00" },
  { id: "x3", event_id: "e1", category_id: "c3", kind: "saida", description: "Catering Bistro 320", amount: 8900, payment_status: "pendente", invoice_ref: null, occurred_on: "2026-06-06", created_at: "2026-06-06T10:00:00" },
  { id: "x4", event_id: "e1", category_id: "c6", kind: "entrada", description: "Patrocínio · Stripe Brasil", amount: 25000, payment_status: "recebido", invoice_ref: null, occurred_on: "2026-05-28", created_at: "2026-05-28T10:00:00" },
  { id: "x5", event_id: "e1", category_id: "c4", kind: "saida", description: "Cachê palestrantes", amount: 14200, payment_status: "pago", invoice_ref: "NF #2235", occurred_on: "2026-05-27", created_at: "2026-05-27T10:00:00" },
  { id: "x6", event_id: "e1", category_id: "c5", kind: "saida", description: "Material gráfico e crachás", amount: 3820, payment_status: "pago", invoice_ref: "NF #2230", occurred_on: "2026-05-25", created_at: "2026-05-25T10:00:00" },
  { id: "x7", event_id: "e2", category_id: "c1", kind: "saida", description: "Reserva Marina da Glória", amount: 85000, payment_status: "pendente", invoice_ref: null, occurred_on: "2026-06-01", created_at: "2026-06-01T10:00:00" },
  { id: "x8", event_id: "e3", category_id: "c2", kind: "saida", description: "Impulsionamento LinkedIn", amount: 1800, payment_status: "pago", invoice_ref: "NF #1104", occurred_on: "2026-06-02", created_at: "2026-06-02T10:00:00" },
];

const activity: Activity[] = [
  { id: "ac1", icon: "👤", text: ["", "Mariana Souza", " confirmou presença no Summit"], created_at: "2026-06-09T16:40:00" },
  { id: "ac2", icon: "💰", text: ["Lançamento de ", "R$ 12.450", " em Marketing aprovado"], created_at: "2026-06-09T11:00:00" },
  { id: "ac3", icon: "✅", text: ["", "Diego Almeida", " concluiu “Fechar contrato com o local”"], created_at: "2026-06-08T15:20:00" },
  { id: "ac4", icon: "🎫", text: ["", "4 novos inscritos", " nesta semana"], created_at: "2026-06-08T09:10:00" },
  { id: "ac5", icon: "⚠️", text: ["Tarefa ", "“Enviar save-the-date”", " está atrasada"], created_at: "2026-06-07T08:00:00" },
];

export function seedState(): DbState {
  return {
    v: SEED_VERSION,
    session: { user_id: null, selected_event_id: "e1" },
    workspace,
    members,
    events,
    attendees,
    tasks,
    categories,
    transactions,
    templates: [],
    activity,
    ingestEndpoints: [],
    settings: {
      toggles: { email: true, push: true, weekly: false, slack: true, public: false, twofa: true },
    },
  };
}
