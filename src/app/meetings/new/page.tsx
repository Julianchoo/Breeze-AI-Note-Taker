import { NewMeeting } from "@/components/meetings/new-meeting";
import { requireAuth } from "@/lib/session";
export const metadata = { title: "New meeting" };
export default async function NewMeetingPage({ searchParams }: {
  searchParams: Promise<{ record?: string; upload?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  return <NewMeeting userId={session.user.id} autoStart={params.record === "1" && params.upload !== "1"} uploadFirst={params.upload === "1"} />;
}
