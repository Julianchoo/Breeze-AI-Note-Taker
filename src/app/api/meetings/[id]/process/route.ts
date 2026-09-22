import { meetingRoute, processMeeting } from "@/lib/meetings";
export const runtime = "nodejs";
export const maxDuration = 240;
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return meetingRoute(request, async (userId) =>
    Response.json(await processMeeting((await context.params).id, userId))
  );
}
