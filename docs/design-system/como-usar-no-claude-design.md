# Como usar este material no Claude Design

Guia rápido pra você gerar telas novas da Nexo com cara de Nexo (e não de IA).

## Passo a passo

1. Abra o **Claude Design** (claude.ai/design) e crie um arquivo novo.
2. No painel **"Start with context"**, clique em **Design system**.
3. Cole o conteúdo de **`nexo-design-system.md`** ali. Esse é o material principal — tokens, classes,
   componentes e regras anti-cara-de-IA, tudo extraído do código real.
4. (Opcional, recomendado) Adicione também o contexto **Codebase** apontando pro repo
   `guibesxo-source/nexo-app` — assim o agente vê o `app.css` e o `kit.tsx` reais e ganha ainda mais fidelidade.
5. Mantenha as tags **Hi-fi design** e **Interactive prototype** ligadas (já vêm marcadas).
6. No prompt, descreva a tela usando o modelo de briefing abaixo.

## Modelo de briefing (copie e preencha)

> **Tela:** [nome — ex.: "Relatório pós-evento"]
> **Objetivo:** [o que a pessoa resolve aqui em 1 frase]
> **Onde encaixa no app:** [vive dentro do shell padrão da Nexo, com sidebar + topbar; é uma view nova
> na navegação X]
> **Conteúdo principal:** [KPIs de X; tabela de Y; card de Z…]
> **Ações:** [CTA principal verde = "…"; secundárias = "…"]
> **Estados:** [vazio, carregando, erro — siga os padrões Empty/Toast/Confirm do design system]
>
> Siga **estritamente** o Nexo Design System que forneci: base preto/branco + verde #00E47C como único
> acento, CTA verde com texto preto, headings 800 com tracking -0.03em, cards chapados com borda fina,
> raios 8/12/16/22, cores de status só com semântica. Nada de gradiente roxo/azul, glow ou cara de template.

## Dicas pra puxar fidelidade

- Peça pra **reusar o shell** (sidebar 252px + topbar 68px + `.page-head`) em vez de inventar layout.
- Mande o agente abrir uma tela existente como referência: *"use o Financeiro como referência de densidade
  e o Dashboard como referência de grid de KPIs"*.
- Se sair algo "genérico", corrija pelo checklist da seção 9 do `nexo-design-system.md` — aponte o item
  específico (ex.: "o CTA está com texto branco; verde sempre com texto preto").
- Para telas com número de destaque (faturamento, meta), peça o **budget card preto com glow verde** —
  é o único lugar onde glow é permitido.

## As telas que você está pensando

Quando souber quais telas extras quer, me manda a lista que eu:
- te ajudo a escrever o briefing de cada uma no modelo acima;
- e, quando você aprovar o resultado visual no Claude Design, porto pro código real do app (JSX + `app.css`),
  mantendo o padrão de `@/lib/db` e do `kit.tsx`.
