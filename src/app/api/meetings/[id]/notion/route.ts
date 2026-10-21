import { getClientEnv } from "@/lib/env";
import { MeetingError } from "@/lib/meeting-validation";
import { getMeeting, isAdmin, meetingRoute, setNotionPageUrl } from "@/lib/meetings";
import { createNotionPage, meetingBlocks, notionInput, notionOptions } from "@/lib/notion";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
// Admin only: pages go to the admin's own Notion workspace.
async function admin(userId: string) {
  if (!(await isAdmin(userId))) throw new MeetingError("Not found.", 404);
}
export function GET(request: Request) {
  return meetingRoute(request, async (userId) => {
    await admin(userId);
    return Response.json(await notionOptions());
  });
}
// Every send creates a new page; the meeting remembers the latest one.
export function POST(request: Request, context: Context) {
  return meetingRoute(request, async (userId) => {
    await admin(userId);
    const id = (await context.params).id;
    const input = notionInput.parse(await request.json());
    const { meeting, segments } = await getMeeting(id, userId);
    if (meeting.status !== "ready" || !meeting.summary) throw new MeetingError("This meeting has no summary yet.", 409);
    const url = await createNotionPage(input, meetingBlocks(meeting, segments, `${getClientEnv().NEXT_PUBLIC_APP_URL}/meetings/${id}`));
    await setNotionPageUrl(id, userId, url);
    return Response.json({ url });
  });
}
