import { MeetingDetailView } from "@/components/meetings/meeting-detail";
export const metadata = { title: "Meeting" };
export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingDetailView id={id} />;
}
