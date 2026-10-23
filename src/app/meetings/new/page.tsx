import { NewMeeting } from "@/components/meetings/new-meeting";
import { requireAuth } from "@/lib/session";
export const metadata = { title: "New meeting" };
export default async function NewMeetingPage({ searchParams }: {
  searchParams: Promise<{ record?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  return <NewMeeting userId={session.user.id} autoStart={params.record === "1"} />;
}
