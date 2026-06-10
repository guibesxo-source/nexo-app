// Dados demo portados do protótipo (repo nexo: app/views-*.jsx).
// Serão substituídos pelas queries de @/lib/db quando o Supabase existir.

export type DemoEvent = {
  id: number;
  nm: string;
  date: string;
  city: string;
  status: [string, string];
  reg: number;
  cap: number;
  cover: string;
  team: string[];
  extra: number;
};

export const EVENTS: DemoEvent[] = [
  { id: 1, nm: "Summit de Marketing 2026", date: "14 mai · 2026", city: "São Paulo", status: ["green", "Ativo"], reg: 320, cap: 400, cover: "linear-gradient(135deg,#00B863,#0A0A0A)", team: ["MC", "RP", "DA"], extra: 5 },
  { id: 2, nm: "Festival Sonora", date: "22 jun · 2026", city: "Rio de Janeiro", status: ["amber", "Planejamento"], reg: 1240, cap: 3000, cover: "linear-gradient(135deg,#7C3AED,#0A0A0A)", team: ["JS", "CL"], extra: 8 },
  { id: 3, nm: "Workshop UX Lab", date: "03 jul · 2026", city: "Online", status: ["green", "Ativo"], reg: 86, cap: 120, cover: "linear-gradient(135deg,#0EA5E9,#0A0A0A)", team: ["PR", "LM"], extra: 2 },
  { id: 4, nm: "Conferência DevBR", date: "19 ago · 2026", city: "Belo Horizonte", status: ["gray", "Rascunho"], reg: 0, cap: 800, cover: "linear-gradient(135deg,#1A1A1A,#444)", team: ["LF"], extra: 0 },
  { id: 5, nm: "Encontro de Líderes", date: "12 set · 2026", city: "Curitiba", status: ["blue", "Inscrições abertas"], reg: 142, cap: 200, cover: "linear-gradient(135deg,#0891B2,#0A0A0A)", team: ["TS", "AF", "VG"], extra: 3 },
  { id: 6, nm: "Gala de Premiação", date: "30 nov · 2026", city: "São Paulo", status: ["amber", "Planejamento"], reg: 64, cap: 500, cover: "linear-gradient(135deg,#B45309,#0A0A0A)", team: ["MC", "RC"], extra: 6 },
];

export type DemoPerson = {
  in: string;
  nm: string;
  em: string;
  co: string;
  st: [string, string];
  reg: string;
  ticket: string;
};

export const PEOPLE: DemoPerson[] = [
  { in: "MC", nm: "Mariana Costa", em: "mariana@octopus.io", co: "Octopus Studio", st: ["green", "Confirmado"], reg: "02 mai · 14h32", ticket: "VIP" },
  { in: "RP", nm: "Rafael Pereira", em: "rafael@brand.co", co: "Brand & Co.", st: ["blue", "Check-in"], reg: "30 abr · 09h17", ticket: "Pro" },
  { in: "JS", nm: "Júlia Santos", em: "julia@hubinc.com", co: "Hub Inc.", st: ["amber", "Pendente"], reg: "05 mai · 11h08", ticket: "Geral" },
  { in: "DA", nm: "Diego Almeida", em: "diego@nexus.ai", co: "Nexus AI", st: ["green", "Confirmado"], reg: "04 mai · 16h44", ticket: "VIP" },
  { in: "CL", nm: "Carolina Lima", em: "caro@summit.co", co: "Summit.co", st: ["green", "Confirmado"], reg: "01 mai · 10h22", ticket: "Pro" },
  { in: "PR", nm: "Pedro Rocha", em: "pedro@brava.studio", co: "Brava Studio", st: ["amber", "Pendente"], reg: "06 mai · 08h55", ticket: "Geral" },
  { in: "LM", nm: "Larissa Melo", em: "larissa@conecta.com", co: "Conecta", st: ["green", "Confirmado"], reg: "29 abr · 19h03", ticket: "Pro" },
  { in: "TS", nm: "Thiago Souza", em: "thiago@ativa.io", co: "Ativa", st: ["blue", "Check-in"], reg: "28 abr · 13h47", ticket: "VIP" },
  { in: "AF", nm: "Ana Ferreira", em: "ana@palco.live", co: "Palco Live", st: ["green", "Confirmado"], reg: "03 mai · 21h12", ticket: "Geral" },
  { in: "VG", nm: "Vitor Gomes", em: "vitor@hubevents.com", co: "Hub Events", st: ["amber", "Pendente"], reg: "06 mai · 07h30", ticket: "Geral" },
];

export type DemoTx = {
  ic: string;
  ttl: string;
  meta: string;
  st: [string, string];
  amt: string;
  dir: "in" | "out";
};

export const TX: DemoTx[] = [
  { ic: "🏢", ttl: "Centro de Convenções WTC", meta: "Local · NF #2241 · 04 mai", st: ["green", "Pago"], amt: "- R$ 42.000,00", dir: "out" },
  { ic: "📣", ttl: "Campanha de mídia paga", meta: "Marketing · NF #2238 · 03 mai", st: ["green", "Pago"], amt: "- R$ 12.450,00", dir: "out" },
  { ic: "🍽️", ttl: "Catering Bistro 320", meta: "Catering · Aguardando NF · 06 mai", st: ["amber", "Pendente"], amt: "- R$ 8.900,00", dir: "out" },
  { ic: "💸", ttl: "Patrocínio · Stripe Brasil", meta: "Receita · 28 abr", st: ["green", "Recebido"], amt: "+ R$ 25.000,00", dir: "in" },
  { ic: "🎤", ttl: "Cachê palestrantes", meta: "Equipe · NF #2235 · 27 abr", st: ["green", "Pago"], amt: "- R$ 14.200,00", dir: "out" },
  { ic: "🖨️", ttl: "Material gráfico e crachás", meta: "Produção · NF #2230 · 25 abr", st: ["green", "Pago"], amt: "- R$ 3.820,00", dir: "out" },
];

export type DemoCat = { nm: string; vl: string; pct: number; c: string };

export const CATS: DemoCat[] = [
  { nm: "Local & Estrutura", vl: "R$ 62.400", pct: 92, c: "var(--green)" },
  { nm: "Marketing", vl: "R$ 38.200", pct: 68, c: "var(--green)" },
  { nm: "Catering", vl: "R$ 27.000", pct: 54, c: "var(--green)" },
  { nm: "Equipe & Cachês", vl: "R$ 20.020", pct: 44, c: "var(--green)" },
];

export type DemoTask = {
  id: string;
  nm: string;
  who: string;
  due: string;
  done: boolean;
  late?: boolean;
};

export type DemoTaskGroup = { g: string; tasks: DemoTask[] };

export const TASK_GROUPS: DemoTaskGroup[] = [
  {
    g: "Pré-produção",
    tasks: [
      { id: "t1", nm: "Definir escopo e objetivo do evento", who: "LF", due: "Concluído", done: true },
      { id: "t2", nm: "Fechar contrato com o local (WTC)", who: "DA", due: "Concluído", done: true },
      { id: "t3", nm: "Aprovar orçamento com a diretoria", who: "LF", due: "Concluído", done: true },
      { id: "t4", nm: "Contratar fornecedor de catering", who: "MC", due: "07 mai", done: false },
    ],
  },
  {
    g: "Marketing & Inscrições",
    tasks: [
      { id: "t5", nm: "Publicar página de inscrição", who: "RP", due: "Concluído", done: true },
      { id: "t6", nm: "Lançar campanha de mídia paga", who: "RP", due: "Concluído", done: true },
      { id: "t7", nm: "Enviar save-the-date", who: "CL", due: "04 mai", done: false, late: true },
      { id: "t8", nm: "Confirmar lista de palestrantes", who: "MC", due: "09 mai", done: false },
      { id: "t9", nm: "Preparar kit de imprensa", who: "CL", due: "11 mai", done: false },
    ],
  },
  {
    g: "Produção & Dia do evento",
    tasks: [
      { id: "t10", nm: "Montar cronograma operacional", who: "DA", due: "10 mai", done: false },
      { id: "t11", nm: "Imprimir crachás e sinalização", who: "PR", due: "12 mai", done: false },
      { id: "t12", nm: "Briefing com a equipe de staff", who: "LF", due: "13 mai", done: false },
      { id: "t13", nm: "Testar equipamentos de A/V", who: "PR", due: "13 mai", done: false, late: true },
    ],
  },
];

export type DemoMember = {
  in: string;
  nm: string;
  role: string;
  tasks: number;
  events: number;
};

export const MEMBERS: DemoMember[] = [
  { in: "LF", nm: "Lucas Ferraz", role: "Owner · Produtor", tasks: 8, events: 6 },
  { in: "MC", nm: "Mariana Costa", role: "Coordenadora", tasks: 12, events: 4 },
  { in: "DA", nm: "Diego Almeida", role: "Produção", tasks: 9, events: 3 },
  { in: "RP", nm: "Rafael Pereira", role: "Marketing", tasks: 7, events: 5 },
  { in: "CL", nm: "Carolina Lima", role: "Comunicação", tasks: 6, events: 2 },
  { in: "PR", nm: "Pedro Rocha", role: "Logística", tasks: 5, events: 3 },
];
