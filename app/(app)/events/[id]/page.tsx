export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="px-8 py-12">
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">
        Evento {id}
      </h1>
      <p className="mt-3 text-muted">
        Dashboard do evento (inscritos, financeiro, checklist) — em construção.
      </p>
    </div>
  );
}
