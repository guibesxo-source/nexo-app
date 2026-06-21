# Nexo · Design System — Contexto para o Claude Design

> **Como usar:** cole este arquivo inteiro no campo **"Design system"** do Claude Design (claude.ai/design).
> Ele descreve a linguagem visual real do app Nexo (extraída do código, não inventada). Toda tela
> nova deve ser construída com este vocabulário — tokens, classes e padrões — para parecer Nexo,
> e **não** uma interface genérica de IA.

---

## 0. A essência (o "norte" anti-cara-de-IA)

Nexo é **preto / branco / verde**. Um único acento de marca, base neutra, tipografia apertada e bold,
bordas finíssimas e sombras discretas. É um SaaS de gestão de eventos — sóbrio, denso de dados, confiante.

**O que faz parecer Nexo (FAÇA):**
- Base monocromática (preto/cinzas/branco) + **um** verde `#00E47C` como único acento de marca.
- Headings **800** com `letter-spacing: -0.03em` (apertados, confiantes).
- Cards **chapados** com borda de 1px `rgba(0,0,0,0.09)`; sombra só no hover/elevação.
- Estado ativo de navegação = **pílula preta sólida** (não verde, não azul).
- "Eyebrows" em caixa-alta, `letter-spacing` largo, cinza.
- Pílulas/badges com fundo tonal suave (`green-soft`, `amber-soft`…).
- CTA verde **sempre com texto preto**. Sem exceção.
- Movimento sutil com `cubic-bezier(0.22, 1, 0.36, 1)`.

**O que é "cara de IA" (NÃO FAÇA):**
- ❌ Gradientes roxo/índigo/azul de fundo, "glow" em tudo, glassmorphism por toda parte.
- ❌ Texto com gradiente, heros centralizados genéricos, emojis decorativos.
- ❌ Mais de um acento competindo (roxo + azul + verde ao mesmo tempo).
- ❌ Cantos `rounded-full` em tudo; raios inconsistentes.
- ❌ Sombras pesadas (drop shadow forte) em cards parados.
- ❌ Cor de marca como CTA com texto branco. (Verde = texto preto.)
- ❌ Visual "shadcn default" sem personalidade.

As cores de status (âmbar/azul/vermelho/roxo) são **funcionais dentro do app** — nunca entram em
marketing nem viram acento decorativo.

---

## 1. Tokens — cole este bloco como base (CSS variables)

O app inteiro é dirigido por estas variáveis. Use-as em vez de hex soltos. Light mode no `:root`,
dark mode sob `[data-theme="dark"]`.

```css
:root {
  /* Neutros */
  --black: #000000;
  --ink: #0A0A0A;
  --ink-2: #111111;
  --ink-3: #1A1A1A;
  --white: #FFFFFF;
  --off-white: #F7F7F5;   /* fundo da página */
  --panel: #FAFAF8;       /* superfícies sutis (headers de tabela, trilhos) */

  /* Acento de marca — ÚNICO */
  --green: #00E47C;
  --green-deep: #00B863;  /* hover do CTA, texto sobre green-soft */
  --green-soft: #E6FBF1;  /* fundo de badge/realce verde */
  --green-glow: rgba(0,228,124,0.35);

  /* Texto */
  --text: #0A0A0A;
  --muted: #4A4A4A;
  --dim: #6B6B6B;
  --faint: #9A9A97;
  --text-inv: #FFFFFF;
  --muted-inv: #B8B8B8;

  /* Linhas / bordas (finíssimas) */
  --line: rgba(0,0,0,0.09);
  --line-2: rgba(0,0,0,0.06);
  --line-strong: rgba(0,0,0,0.16);

  /* Status — funcionais, NÃO decorativos */
  --amber: #B45309;  --amber-soft: #FEF3C7;
  --blue:  #0369A1;  --blue-soft:  #E0F2FE;
  --red:   #DC2626;  --red-soft:   #FEE2E2;
  --purple:#7C3AED;

  /* Raios (escala fixa 8/12/16/22) */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 22px;

  /* Sombras (discretas; elevação só quando precisa) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 6px 24px -8px rgba(0,0,0,0.14);
  --shadow-lg: 0 24px 60px -20px rgba(0,0,0,0.30);

  /* Layout / motion */
  --sidebar-w: 252px;
  --topbar-h: 68px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

[data-theme="dark"] {
  color-scheme: dark;
  --white: #161614;     /* superfícies viram escuras */
  --off-white: #0D0D0C; /* fundo da página */
  --panel: #1E1E1C;
  --text: #F2F2F0; --muted: #C6C6C2; --dim: #989894; --faint: #73736F;
  --line: rgba(255,255,255,0.10);
  --line-2: rgba(255,255,255,0.06);
  --line-strong: rgba(255,255,255,0.22);
  --green-deep: #00D673; --green-soft: rgba(0,228,124,0.13);
  --amber: #F5A524; --amber-soft: rgba(245,165,36,0.15);
  --blue: #4CC2F1;  --blue-soft:  rgba(56,189,248,0.14);
  --red: #F87171;   --red-soft:   rgba(248,113,113,0.14);
  --purple: #A78BFA;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 6px 24px -8px rgba(0,0,0,0.55);
  --shadow-lg: 0 24px 60px -20px rgba(0,0,0,0.7);
}
```

**Regra de ouro do dark mode:** o sistema inteiro é dirigido pelas variáveis acima — só os neutros são
remapeados. Pares "preto-no-branco" (nav ativa, chip ativo, pager ativo) viram "branco-no-preto".

---

## 2. Tipografia

- **Fonte única: Inter** (`next/font`, variável `--font-inter`), com `-webkit-font-smoothing: antialiased`.
- Base do app: `font-size: 14px; line-height: 1.5`.
- **Headings são apertados e pesados:** `font-weight: 800; letter-spacing: -0.03em` (títulos grandes)
  ou `-0.02em` (médios). Isso é assinatura — não usar peso normal em título.
- Seleção de texto: fundo verde, cor preta (`::selection { background:#00E47C; color:#000 }`).

| Uso | Tamanho | Peso | Tracking | Cor |
|---|---|---|---|---|
| Título de página (`.page-title`) | 30px | 800 | -0.03em | `--text` |
| Título de seção (`.section-title`) | 17px | 800 | -0.02em | `--text` |
| Título de card (`.card-title`) | 15px | 700 | -0.01em | `--text` |
| KPI valor (`.kpi-val`) | 30px | 800 | -0.03em | `--text` |
| Eyebrow (`.page-eyebrow`) | 11px | 700 | **+0.12em**, UPPERCASE | `--dim` |
| Corpo | 13.5–14px | 400–600 | — | `--text`/`--muted` |
| Meta / legenda | 11.5–12.5px | 500–600 | — | `--dim`/`--faint` |
| Rótulo de coluna de tabela | 11px | 700 | +0.07em, UPPERCASE | `--dim` |

---

## 3. Espaçamento, raios, layout, motion

- **Raios:** use só a escala `8 / 12 / 16 / 22`. Botões/inputs = 8 (`--r-sm`); cards = 16 (`--r-lg`);
  modais/diálogos = 16–22; pílulas/badges/avatares = `99px`.
- **Layout do app (shell):** sidebar de `252px` à esquerda + main. Topbar de `68px` com blur
  (`backdrop-filter: saturate(160%) blur(12px)`). Conteúdo com `padding: 30px 36px 60px` e
  `max-width: 1320px` centralizado.
- **Grids comuns:** KPIs em `repeat(4, 1fr)` (cai pra 2 e 1 no mobile); conteúdo 2 colunas
  `1.6fr 1fr` (`.grid-2`) ou `1fr 1fr` (`.grid-2b`).
- **Motion:** transições de `0.13s–0.18s` com `var(--ease)`. Hover de ícone faz "pop"
  (`scale(1.2)` com leve giro). Respeite `prefers-reduced-motion`.
- **Densidade:** cards com `padding: 18–20px`; gaps de grid `14–16px`. Interface densa mas arejada.

---

## 4. Iconografia

- Ícones **stroke** (linha), `stroke-width: 1.9`, `stroke-linecap/linejoin: round`, `currentColor`,
  viewBox `0 0 24 24`, tamanho padrão 18px. Estilo Feather/Lucide — **nunca** ícones preenchidos ou coloridos.
- Set usado no app (nomes → conceito): `grid` (dashboard), `calendar`/`calendarDays`, `users`/`team`,
  `wallet` (financeiro), `checkSquare` (checklist), `paperclip` (arquivos), `settings`, `link`
  (integrações), `search`, `bell`, `plus`, `download`/`upload`, `trending`, `bolt`, `sparkle`,
  `mapPin`, `clock`, `ticket`, `edit`, `trash`, `dots` (menu de ações), `chevRight/Down/Left/Up`.

---

## 5. Vocabulário de componentes (com CSS canônico)

Reproduza estes padrões. Os nomes de classe são os reais do app — pode usá-los como referência 1:1.

### Botões
```css
.btn { display:inline-flex; align-items:center; gap:8px; border:1px solid var(--line);
  background:var(--white); color:var(--text); border-radius:var(--r-sm);
  padding:9px 15px; font-size:13.5px; font-weight:600; line-height:1; transition:all .15s var(--ease); }
.btn:hover { border-color:var(--line-strong); }
.btn-primary { background:var(--green); border-color:var(--green); color:#000; font-weight:700; }  /* CTA: verde + texto PRETO */
.btn-primary:hover { background:var(--green-deep); border-color:var(--green-deep); }
.btn-dark { background:#000; border-color:#000; color:#fff; }
.btn-ghost { background:transparent; border-color:transparent; }
.btn-ghost:hover { background:var(--panel); }
.btn-danger { background:var(--red); color:#fff; border-color:var(--red); }
.btn-sm { padding:7px 11px; font-size:12.5px; }
```
Hierarquia: **`.btn-primary` (verde) é o CTA principal**, um por contexto. `.btn` (branco com borda) é
secundário. `.btn-dark` para ação de destaque não-verde. `.btn-ghost` para terciário.

### Card (a unidade base de tudo)
```css
.card { background:var(--white); border:1px solid var(--line); border-radius:var(--r-lg); padding:20px; }
.card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.card-title { font-size:15px; font-weight:700; letter-spacing:-0.01em; }
.card-link { font-size:12.5px; color:var(--dim); font-weight:600; } /* "ver tudo →" */
.card-link:hover { color:var(--green-deep); }
```

### Badge / pílula de status
```css
.badge { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:99px;
  font-size:11.5px; font-weight:600; }
.badge i { width:6px; height:6px; border-radius:99px; background:currentColor; } /* dot opcional */
.badge.green { background:var(--green-soft); color:var(--green-deep); }
.badge.amber { background:var(--amber-soft); color:var(--amber); }
.badge.blue  { background:var(--blue-soft);  color:var(--blue); }
.badge.red   { background:var(--red-soft);   color:var(--red); }
.badge.gray  { background:var(--panel); color:var(--dim); border:1px solid var(--line); }
```

### KPI / stat card
```css
.kpi { background:var(--white); border:1px solid var(--line); border-radius:var(--r-lg); padding:18px 18px 16px; }
.kpi:hover { border-color:var(--line-strong); box-shadow:var(--shadow-sm); }
.kpi-ic { width:36px; height:36px; border-radius:10px; display:inline-flex; align-items:center;
  justify-content:center; background:var(--panel); border:1px solid var(--line); color:var(--text); }
.kpi-ic.green { background:var(--green-soft); border-color:rgba(0,184,99,0.2); color:var(--green-deep); }
.kpi-val { font-size:30px; font-weight:800; letter-spacing:-0.03em; line-height:1; }
.kpi-lbl { font-size:12.5px; color:var(--dim); margin-top:6px; }
.kpi-delta.up { color:var(--green-deep); }  .kpi-delta.down { color:var(--red); }  /* ▲▼ com ícone arrowUp/Down */
```
Topo do KPI: ícone em caixa à esquerda + delta (▲/▼ com %) à direita. Valor grande embaixo, label, e
um rodapé opcional de insight (`.kpi-foot`, com dot colorido por tom).

### Input / Field
```css
.input { width:100%; background:var(--white); border:1px solid var(--line); border-radius:var(--r-sm);
  padding:10px 13px; font-size:14px; color:var(--text); transition:all .15s var(--ease); }
.input:focus { outline:none; border-color:#000; }      /* foco = borda PRETA (no dark, branca) */
.input::placeholder { color:var(--faint); }
.field-label { font-size:12.5px; font-weight:600; color:var(--muted); margin-bottom:7px; display:block; }
.field-err { color:var(--red); font-size:12px; margin-top:5px; }
.input-search { display:flex; align-items:center; gap:9px; height:40px; padding:0 13px;
  border:1px solid var(--line); border-radius:var(--r-md); background:var(--white); }
.input-search:focus-within { border-color:#000; }
```

### Chip (filtro) e Segmented control
```css
.chip { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:99px;
  font-size:12.5px; font-weight:600; border:1px solid var(--line); background:var(--white); color:var(--muted); }
.chip.active { background:#000; border-color:#000; color:#fff; }  /* ativo = preto sólido */

.seg { display:inline-flex; background:var(--panel); border:1px solid var(--line);
  border-radius:var(--r-md); padding:4px; gap:2px; }
.seg button { border:0; background:transparent; padding:7px 15px; border-radius:8px;
  font-size:13px; font-weight:600; color:var(--muted); }
.seg button.active { background:var(--white); color:var(--text); box-shadow:var(--shadow-sm); }
```

### Tabela
```css
.tbl-wrap { background:var(--white); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
table.tbl { width:100%; border-collapse:collapse; font-size:13.5px; }
table.tbl th { text-align:left; padding:13px 18px; font-size:11px; text-transform:uppercase;
  letter-spacing:0.07em; color:var(--dim); font-weight:700; background:var(--panel);
  border-bottom:1px solid var(--line); }
table.tbl td { padding:14px 18px; border-bottom:1px solid var(--line-2); }
table.tbl tbody tr:hover { background:var(--panel); }
```
Célula de pessoa = avatar + nome (600) + email (`--dim`, 12px). Ações da linha via ícone `dots`
(`.row-action`) abrindo um menu. Rodapé com paginação (`.pager`, botão ativo preto).

### Toggle (switch)
```css
.toggle { width:44px; height:26px; border-radius:99px; background:var(--line-strong); position:relative; border:0; }
.toggle::after { content:""; position:absolute; top:3px; left:3px; width:20px; height:20px;
  border-radius:99px; background:var(--white); box-shadow:var(--shadow-sm); transition:transform .18s var(--ease); }
.toggle.on { background:var(--green-deep); }
.toggle.on::after { transform:translateX(18px); }
```

### Avatar
- Círculo `99px`, iniciais brancas bold. **Cor derivada das iniciais** (determinística), de uma paleta
  fixa: `#F97316 #0EA5E9 #A855F7 #10B981 #F43F5E #EAB308 #6366F1 #14B8A6 #EC4899 #0891B2 #8B5CF6 #F59E0B`.
- Tamanhos: `.sm` 26px, padrão 32px, `.lg` 44px. Stack de avatares com borda branca de 2px e overlap -8px.

### Modal, Confirm dialog, Toast, Menu, Empty
- **Modal:** scrim `rgba(0,0,0,0.45)`, card branco `--r-lg`, header com título 17px/800 e botão "x" fantasma.
- **Confirm dialog:** centralizado, **scrim com blur** (`backdrop-filter: blur(14px)`), ícone em círculo
  (verde por padrão, vermelho `--red-soft` se destrutivo), título 18px/800, 2 botões (cancelar + confirmar/danger).
- **Toast:** barra **preta**, texto branco, check verde, fixa embaixo-centro. Pode ter ação "Desfazer"
  (botão verde com texto preto).
- **Menu de ações:** dropdown branco, itens 13.5px; item `.danger` em vermelho.
- **Empty state:** ícone em caixa cinza arredondada (`sparkle` por padrão), título 15px/700, subtítulo `--dim`,
  CTA opcional.

---

## 6. Sistema de status / tons (semântica fixa)

Use estes mapeamentos — eles são consistentes no app inteiro:

**Status de evento:** Rascunho → `gray` · Planejamento → `amber` · Ativo (confirmado) → `green` ·
Encerrado → `blue` · Cancelado → `red`.
**Prioridade:** Alta → `red` · Média → `amber` · Baixa → `gray`.
**Status de inscrito:** Pendente → `amber` · Confirmado → `green` · Check-in → `blue` · Cancelado → `red`.
**Pagamento:** Pago/Recebido → `green` · Pendente → `amber`.
**Financeiro:** entrada/receita = `--green-deep`; saída/despesa = `--red`.

---

## 7. Elementos-assinatura (o que torna inconfundível)

1. **Brand mark:** quadrado preto `30px`, raio `9px`, com um **dot verde** central de `12px` cercado por
   anel duplo (`box-shadow: 0 0 0 3px #000, 0 0 0 4.5px var(--green)`). É o logo do app.
2. **Marcador verde "torto":** trecho de título com fundo verde, texto preto, raio 8px, `rotate(-1deg)` e
   sombra verde suave — usado para destacar uma palavra no hero. Assinatura da marca.
3. **Budget/hero card preto:** card `background:#000`, texto branco, com **glow radial verde** animado nos
   cantos e um "facho" que segue o cursor. Usado para o número grande do financeiro. Único lugar com glow.
4. **Capas de evento (gradientes):** todo evento tem uma capa-gradiente diagonal terminando em quase-preto.
   Catálogo fixo:
   - Esmeralda `linear-gradient(135deg,#00B863,#0A0A0A)`
   - Violeta `linear-gradient(135deg,#7C3AED,#0A0A0A)`
   - Céu `linear-gradient(135deg,#0EA5E9,#0A0A0A)`
   - Oceano `linear-gradient(135deg,#0891B2,#0A0A0A)`
   - Âmbar `linear-gradient(135deg,#B45309,#0A0A0A)`
   - Grafite `linear-gradient(135deg,#1A1A1A,#444)`
   (As capas fazem um "drift" lento do background-position — movimento sutil, não chamativo.)
5. **Nav ativa = pílula preta.** O item de menu selecionado é fundo preto, texto branco — nunca verde.
6. **Contadores na sidebar:** pílula `green-soft`/`green-deep`; se for alerta (tarefa atrasada), vira
   `amber-soft`/`amber`.

---

## 8. Estrutura de tela (shell + página)

Toda tela logada vive dentro do shell:
- **Sidebar (252px):** brand mark + nome "Nexo" → seletor de evento (card com dot-gradiente) → nav com
  contadores → seção "ORGANIZAÇÃO" (eyebrow) → nav secundária → rodapé com usuário (avatar + nome + email + sair).
- **Topbar (68px):** breadcrumb "Nexo › [Página]" à esquerda, **busca global centralizada** (Ctrl+K),
  e à direita: toggle de tema (sol/lua) · sino de notificações (com dot) · **CTA "Novo evento" (botão verde)**.
- **Página:** `.page-head` com eyebrow (opcional) + título 30px/800 + subtítulo, e `.page-actions` à direita
  (botões). Depois, o conteúdo (grids de KPI, cards, tabelas).

**Telas que já existem** (replique o tom destas, não reinvente o shell): Dashboard (KPIs + widgets
customizáveis), Eventos (cards com capa), Calendário (grade mensal + notas por dia), Inscritos (tabela +
busca + filtros por faceta + CSV), Financeiro (budget card preto + transações), Checklist (tarefas em fases
pré/durante/pós), Arquivos (grid de cards por categoria), Membros (cards), Integrações (grid de cards de
serviço), Configurações (nav lateral + linhas de toggle).

---

## 9. Checklist final antes de entregar uma tela

- [ ] Base preto/branco/cinza + **um** verde como acento? (Sem roxo/azul decorativo.)
- [ ] Todo CTA verde está com **texto preto**?
- [ ] Headings em **800** com tracking negativo?
- [ ] Cards chapados com borda `--line` de 1px e raio 16? Sombra só no hover?
- [ ] Raios só na escala 8/12/16/22 (pílulas em 99px)?
- [ ] Cores de status usadas só com semântica (não como enfeite)?
- [ ] Nav/seleção ativa em **preto sólido** (não verde)?
- [ ] Ícones stroke 1.9, monocromáticos?
- [ ] Eyebrows em UPPERCASE com tracking largo?
- [ ] Funciona em dark mode trocando só os neutros?
- [ ] Nada de gradiente de fundo genérico, glow em tudo, ou "cara de template"?
