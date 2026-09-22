import { createMeeting, listMeetings, meetingRoute } from "@/lib/meetings";
export const runtime = "nodejs";
export function GET(request: Request) {
  return meetingRoute(request, async (userId) =>
    Response.json({ meetings: await listMeetings(userId) })
  );
}
export function POST(request: Request) {
  return meetingRoute(request, async (userId) =>
    Response.json({ meeting: await createMeeting(userId, await request.json()) }, { status: 201 })
  );
}
