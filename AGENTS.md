<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# nexo-app

App real do **Nexo** (SaaS de gestão de eventos) — Next.js (App Router) + Supabase + Vercel + Stripe. Repo irmão do protótipo/LP `guibesxo-source/nexo` (local: `C:\Users\guibess\Desktop\Nexo`), onde vivem os docs de produto (`docs/01–11`).

**Projeto pessoal do Guilherme Bessa** (solo founder). Estado: **F1 — esqueleto**; sem schema/auth/billing ainda.

## ⚠️ Separação Prolog × Nexo (REGRA CRÍTICA)

Nexo é pessoal — NUNCA misturar com o trabalho da Prolog App.
- Conta pessoal: guibesxo@gmail.com · HubSpot do Nexo: portal pessoal `51566439`.
- **PROIBIDO** usar o HubSpot da Prolog (`44667852`) — a integração HubSpot do Claude está logada na Prolog; não usar para o Nexo.

## Padrões (de `docs/04-arquitetura-tecnica.md` do repo do protótipo)

- TypeScript ponta a ponta; tipos do banco via `supabase gen types` (→ `types/database.ts`, fase futura).
- **Zod nas bordas** (formulários e route handlers) — schemas em `lib/validations/`.
- Server Components + Server Actions por padrão; client components só com interação/tempo real.
- **Queries só em `@/lib/db`** — nada de query crua na UI. Clients Supabase em `@/lib/supabase` (client.ts / server.ts via `@supabase/ssr`).
- Multi-tenant: shared schema isolado por `workspace_id` com **RLS** em todas as tabelas (fase do schema).
- Imports absolutos `@/*`.

## Design tokens

Definidos em `app/globals.css` via `@theme` (Tailwind v4, CSS-first) — portados do protótipo (`app/app.css` + `index.html`).
- Verde `#00E47C` é o **único** acento de marca; **CTA verde sempre com texto preto**.
- Fonte única **Inter** (next/font, variable `--font-inter`), headings 800 com tracking -0.03em.
- Raios reconciliados na escala do app: `--radius-sm 8 / md 12 / lg 16 / xl 22`.
- Cores de status (âmbar/azul/vermelho/roxo) são funcionais do app — não entram em marketing.
- Layout: `--sidebar-w 252px`, `--topbar-h 68px`, `--ease` em `:root`.

## Comandos

```bash
npm run dev     # desenvolvimento (Turbopack)
npm run lint
npm run build
```

## Ambiente

`.env.example` lista as variáveis (Supabase + Stripe). `.env.local` ainda não existe — será criado quando o projeto Supabase nascer. `SUPABASE_SERVICE_ROLE_KEY` só em server/Edge Functions, nunca no client.
