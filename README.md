# Nexo App

Aplicativo real do **Nexo**, SaaS de gestão de eventos para produtores acompanharem inscrições, checklist, financeiro, equipe e integrações em um único painel.

Este repo é o app Next.js em produção evolutiva. O protótipo/LP fica no repo irmão `guibesxo-source/nexo`.

## Estado atual

- Next.js App Router + TypeScript.
- UI funcional sobre uma camada local em `@/lib/db`.
- Persistência local por usuário via `localStorage`.
- Supabase Auth já integrado para login/cadastro, mas o sync completo dos dados para nuvem ainda é o próximo incremento.
- Deploy automático na Vercel a partir da branch `main`.

## Principais módulos

- `app/(app)` - rotas autenticadas da área logada.
- `components/app/views` - telas principais: dashboard, eventos, inscritos, checklist, financeiro, membros, configurações e integrações.
- `components/app` - componentes de produto e modais de importação/sync.
- `lib/db` - store local, actions, seletores derivados e seed demo.
- `lib/validations` - schemas Zod usados nas bordas.
- `app/api/*` - proxies server-side para APIs externas.
- `supabase/migrations` - schema inicial planejado para a fase Supabase.

## Integrações

### Sympla

A integração usa a API pública do Sympla via proxy local em `app/api/sympla/route.ts`.

Fluxo atual:

1. O usuário conecta o token do Sympla na tela **APIs & Integrações**.
2. O Nexo lista eventos do Sympla.
3. O usuário cria um evento novo no Nexo ou vincula um evento Sympla a um evento existente.
4. A sincronização importa participantes pelo identificador externo do ingresso/participante, não apenas por email.
5. O dashboard e a tela de inscritos fazem auto-sync enquanto estiverem abertos.

Essa regra evita o problema de colapsar vários ingressos comprados com o mesmo email em uma única pessoa no dashboard.

### HubSpot

Importa submissões de formulários do portal pessoal do Nexo.

Atenção: **não usar o HubSpot da Prolog**. O Nexo é pessoal e usa o portal pessoal do Guilherme.

### ClickUp

Importa tarefas de uma lista ClickUp para o checklist do evento selecionado.

## Comandos

```bash
npm run dev
npm run lint
npm run build
```

## Variáveis de ambiente

Use `.env.example` como base. O arquivo `.env.local` deve ficar fora do Git.

Variáveis sensíveis, como `SUPABASE_SERVICE_ROLE_KEY`, nunca devem ir para o client.

## Padrões de desenvolvimento

- A UI deve importar dados e mutações apenas de `@/lib/db`.
- Validações de formulário e route handlers usam Zod.
- Imports absolutos usam `@/*`.
- O verde `#00E47C` é o único acento de marca; CTA verde sempre usa texto preto.
- Antes de alterar APIs do Next.js, consulte a documentação local em `node_modules/next/dist/docs/`, porque esta versão tem mudanças de comportamento.

## Deploy

O deploy principal roda pela Vercel na branch `main`.
