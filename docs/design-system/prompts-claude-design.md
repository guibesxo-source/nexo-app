# Prompts para o Claude Design — Sidebar · Dashboard · Financeiro (patrocinadores)

> **Pré-requisito:** carregue antes o `nexo-design-system.md` no contexto **Design system** (e, se possível,
> o **Codebase** apontando pro repo). Cada prompt abaixo assume que o agente já conhece os tokens e o
> vocabulário da Nexo.
>
> **Ordem recomendada:** 1) Sidebar → 2) Dashboard → 3) Financeiro. A sidebar e a topbar formam o *shell*
> que as outras telas herdam — aprove o shell primeiro.
>
> Em cada prompt, **MANTER** = o que dá identidade Nexo (não mexer). **ELEVAR/ADICIONAR** = o "tapa".

---

## 1 · Sidebar (+ shell) — cole no Claude Design

```
Redesenhe a SIDEBAR do app Nexo (SaaS de gestão de eventos), seguindo ESTRITAMENTE o Nexo Design
System que forneci. Objetivo: dar um tapa de craft e hierarquia, SEM descaracterizar — continua
parecendo Nexo, não um template genérico.

Contexto (anatomia atual, da esquerda, 252px, fundo branco, borda direita de 1px):
- Topo: brand mark (quadrado preto com dot verde + anel duplo) + wordmark "Nexo".
- Seletor de evento: card com dot-gradiente (iniciais), nome do evento, "data · local", chevron;
  abre dropdown para trocar de evento.
- Nav principal: Dashboard, Eventos, Calendário, Inscritos, Financeiro, Checklist, Arquivos —
  cada item com contador (pílula green-soft; vira âmbar quando há tarefa atrasada).
- Seção "ORGANIZAÇÃO" (eyebrow): Membros, APIs & Integrações, Configurações.
- Rodapé: botão recolher menu + bloco do usuário (avatar, nome, email, sair).
- Item ativo = pílula PRETA sólida. Modo recolhido (76px, só ícones) com tooltips.

MANTER (identidade — não trocar):
- Fundo branco, borda hairline, item ativo em preto sólido, brand mark com dot verde, Inter.
- Contadores em pílula (green-soft / âmbar p/ alerta). Modo recolhido. Pronto p/ dark mode.

ELEVAR / ADICIONAR:
- Transforme o seletor de evento num "bloco de contexto do evento" mais rico: além de nome e data,
  mostre um badge de status (Ativo/Planejamento/Encerrado, com as cores de status do DS), um
  countdown discreto ("faltam X dias") e um anel/min-progresso de saúde (ex.: % de capacidade ou
  checklist). Que a sidebar sempre revele o pulso do evento de relance.
- Refine ritmo e hierarquia: espaçamento entre grupos, peso dos rótulos de seção, um indicador
  sutil no item ativo (além da pílula preta).
- No rodapé, acima do usuário, adicione um chip discreto de workspace/plano (ex.: "Workspace ·
  Plano Pro" ou uso) — coerente com SaaS, sem poluir.
- Capriche no modo recolhido: ícones centralizados, tooltips, e o seletor de evento virando um
  flyout lateral.

Entregue em hi-fi e interativo, com hover/ativo e os estados recolhido/expandido. Use os tokens e
classes do DS (var(--*), .sb-*, badges de status). Nada de gradiente roxo/azul, glow ou cara de IA.
```

---

## 2 · Dashboard — cole no Claude Design

```
Redesenhe a tela DASHBOARD ("Visão geral") do Nexo seguindo ESTRITAMENTE o Nexo Design System.
Objetivo: virar um verdadeiro "centro de comando" do evento, mantendo a cara Nexo.

Contexto (anatomia atual):
- Vive dentro do shell (sidebar + topbar). PageHead: eyebrow = nome do evento, título "Visão geral",
  subtítulo de status (ex.: sync do Sympla · nº de inscritos). Ações: Sync Sympla, Importar lista,
  Personalizar, Novo evento (CTA verde).
- Corpo: grade de WIDGETS customizáveis (o usuário adiciona/remove/reordena/redimensiona).
  Tipos: KPIs (¼ ou ½, com mini-estatísticas laterais e um rodapé de insight que muda com a
  performance), gráfico "Inscritos por data" (barras, com seletor de período e pílula de META/dia),
  donut "Confirmação", "Custo por inscrito", lista "Insights do evento", "Gastos por categoria",
  "Atividade recente", "Progresso por área".

Métricas reais disponíveis (use-as): total de inscritos vs capacidade/meta, taxa de confirmação,
check-ins, dias para o evento, meta/dia para bater a lotação, % de orçamento executado, custo por
inscrito, % de checklist.

MANTER:
- O conceito de grade de widgets customizável (modo de edição: arrastar, redimensionar ¼→½→¾→1).
- KPI card com ícone em caixa, valor 30px/800, delta ▲▼, mini-estatísticas laterais e rodapé de
  insight com dot colorido por tom. Donut e barras no estilo do DS. PageHead com eyebrow.

ELEVAR / ADICIONAR:
- Adicione, no topo (acima da grade), uma faixa-resumo fixa do evento: nome + badge de status +
  countdown ("faltam X dias") + 3 números-herói (inscritos/meta com barra de progresso, % de
  confirmação, % de orçamento). É o "de relance" do evento — sempre presente.
- Eleve o gráfico "Inscritos por data" a peça central, com a meta/dia bem destacada (atingida vs
  faltando).
- Dê um KPI/medidor de "saúde do evento" combinando captação + checklist + orçamento.
- Reative o modo "Personalizar" como edição visível (hoje está desabilitado): botão claro p/ entrar/
  sair da edição, e um modal de "Adicionar widget" com abas KPIs / Gráficos & listas / Métrica
  personalizada.
- Capriche nos estados: dashboard vazio (CTA p/ adicionar widget) e o modo edição (contornos
  tracejados, controles por card).

Hi-fi e interativo. Tokens/classes do DS (.kpi, .card, .donut, .bars, .dash-*). Base preto/branco +
verde como único acento; CTA verde com texto preto. Sem visual genérico de IA.
```

---

## 3 · Financeiro + Patrocinadores — cole no Claude Design

```
Redesenhe a tela FINANCEIRO do Nexo e ADICIONE uma camada de PATROCÍNIO voltada aos patrocinadores,
seguindo ESTRITAMENTE o Nexo Design System. Objetivo: além de controlar orçamento, dar "algo a mais
para os patrocinadores" — gestão de cotas e um relatório de valor para enviar a eles.

Contexto (anatomia atual):
- Shell + PageHead "Financeiro" (sub: evento · orçamento). Ações: Relatório (CSV), Lançamento (CTA).
- HERO: card PRETO com glow verde radial animado que segue o cursor — "Gasto até agora" (valor
  grande), % do orçamento, disponível, mini-barras (Orçamento / Custos / Receitas) e uma nota de
  insight (ex.: estouro, cobertura das receitas). É a assinatura da tela — MANTER.
- Card "Por categoria" (ranking de despesas com barras).
- Card "Proposto × Realizado" com alternância Barras / Linha / Donut.
- 3 KPIs clicáveis (Despesas, Receitas, Pendente) que abrem um modal-resumo com os lançamentos.
- "Custo por inscrito" (custo, receita e resultado por inscrito).
- Lista de "Lançamentos" (segmented Todos/Despesas/Receitas), com anexo de NF/boleto e menu de ações.

MANTER:
- O hero preto com glow verde (único lugar com glow), a estrutura grid-2, os 3 KPIs clicáveis, o
  Proposto×Realizado, o Custo por inscrito e a lista de lançamentos. Cores: entrada=verde, saída=
  vermelho; status de pagamento em badges (Pago=green, Pendente=amber).

ELEVAR / ADICIONAR — camada de patrocínio:
- Bloco "Patrocínio" com: total captado vs META de captação (barra de progresso), e quebra por COTA
  (ex.: Diamante / Ouro / Prata / Bronze) com valor e quantidade.
- Pipeline de patrocinadores: cada patrocinador é uma linha/card com logo (ou iniciais coloridas),
  cota, valor, e STATUS no funil (Prospect → Proposta → Fechado → Pago) usando as cores de status do
  DS. Clicar abre um drawer/modal de detalhe: dados de contato, cota, valor, status de pagamento,
  contrato anexado, e um checklist de CONTRAPARTIDAS/entregáveis (logo no palco, posts, estande, etc.).
- Trate patrocínio como receita de primeira classe: separe "Receitas" em Patrocínio / Vendas / Outros.

ADICIONAR — fluxo novo "Relatório do patrocinador" (o "algo a mais"):
- Um one-pager compartilhável/exportável (PDF ou link) que mostra ao patrocinador o VALOR entregue:
  alcance (inscritos / confirmados / check-ins), leads gerados, exposição de marca (canais, posts,
  menções), entregáveis cumpridos (do checklist de contrapartidas) e fotos do evento.
- Visual premium no padrão Nexo: capa com o hero preto + glow verde, KPIs grandes, a logo do
  patrocinador em destaque, e o selo Nexo. Botões "Exportar PDF" e "Copiar link".
- Pode ser por patrocinador (mostrando a cota dele) ou um resumo do evento. Inclua o estado vazio
  ("nenhum patrocinador ainda") com CTA para adicionar.

Hi-fi e interativo, com os modais/drawers e estados (vazio, edição). Tokens/classes do DS
(.budget-card, .kpi, .badge, .catx-*, .tx-row, .seg). Verde como único acento, CTA verde com texto
preto, números 800 com tracking negativo. Sem gradiente genérico ou cara de IA.
```

---

## Dicas de uso

- Gere **uma tela por vez** e aprove antes de ir pra próxima (a sidebar primeiro, pois é o shell).
- Se o resultado sair "genérico", corrija apontando o **item específico** do checklist (seção 9 do
  `nexo-design-system.md`) — ex.: *"o CTA está com texto branco; verde sempre com texto preto"*.
- Peça referência cruzada: *"use o Financeiro atual como referência de densidade"*.
- Quando aprovar o visual, me manda que eu **porto pro código real** (JSX + `app.css`, no padrão do
  `kit.tsx` e do `@/lib/db`) — incluindo o modelo de dados novo de patrocinadores/cotas.
```
