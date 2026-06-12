import { EventOverview } from "@/components/app/views/event-overview";

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventOverview eventId={id} />;
}
