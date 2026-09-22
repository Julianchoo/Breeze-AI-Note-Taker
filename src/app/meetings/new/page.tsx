import { NewMeeting } from "@/components/meetings/new-meeting";
import { requireAuth } from "@/lib/session";
export const metadata = { title: "New meeting" };
export default async function NewMeetingPage() {
  const session = await requireAuth();
  return <NewMeeting userId={session.user.id} />;
}
