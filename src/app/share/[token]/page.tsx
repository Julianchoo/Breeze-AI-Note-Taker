import { cache } from "react";
import { notFound } from "next/navigation";
import { SharedMeetingView } from "@/components/meetings/shared-meeting-view";
import { MeetingError } from "@/lib/meeting-validation";
import { getSharedMeeting } from "@/lib/meetings";
import type { Metadata } from "next";
type Props = { params: Promise<{ token: string }> };
// Called by both generateMetadata and the page; cache() makes it one query per request.
const load = cache(async (token: string) => {
  try {
    return await getSharedMeeting(token);
  } catch (error) {
    if (error instanceof MeetingError && error.status === 404) notFound();
    throw error;
  }
});
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meeting = await load((await params).token);
  const date = new Date(meeting.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" });
  const sections = [meeting.summary && "AI summary", meeting.chunks && "recording", meeting.segments && "transcript"].filter(Boolean);
  const description = `${date} · ${Math.max(1, Math.round(meeting.durationSeconds / 60))} min meeting.${sections.length ? ` Includes ${sections.join(", ")}.` : ""} Shared from Breeze.`;
  // The token is in the URL: keep it out of search engines and Referer headers.
  return {
    title: meeting.title, description, robots: { index: false, follow: false }, referrer: "no-referrer",
    openGraph: { title: meeting.title, description, siteName: "Breeze", type: "article" },
    twitter: { card: "summary_large_image", title: meeting.title, description },
  };
}
export default async function SharePage({ params }: Props) {
  const { token } = await params;
  return <SharedMeetingView token={token} meeting={await load(token)} />;
}
