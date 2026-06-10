// Camada de acesso a dados: todas as queries tipadas do Supabase entram aqui
// na fase do schema (uma função por operação, isoladas por workspace_id/RLS).
// Nada de query crua na UI — componentes importam apenas de @/lib/db.

export {};
