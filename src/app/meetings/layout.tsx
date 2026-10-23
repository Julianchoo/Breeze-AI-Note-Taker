import { MeetingNavigation } from "@/components/meetings/meeting-navigation";
import { requireAuth } from "@/lib/session";
export const metadata = { robots: { index: false, follow: false } };
export default async function MeetingsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <MeetingNavigation />
      {children}
    </>
  );
}
