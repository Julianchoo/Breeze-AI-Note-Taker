import { searchMeetings } from "@/lib/meeting-search";
import { meetingRoute } from "@/lib/meetings";
export const runtime = "nodejs";
export function GET(request: Request) {
  return meetingRoute(request, async (userId) =>
    Response.json({ results: await searchMeetings(userId, new URL(request.url).searchParams.get("q")) })
  );
}
