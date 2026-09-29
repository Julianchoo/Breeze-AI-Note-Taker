import { MeetingError } from "@/lib/meeting-validation";
import { isAdmin, meetingRoute } from "@/lib/meetings";
import { ensureFolder, onedriveConnected } from "@/lib/onedrive";
export const runtime = "nodejs";
// Admin only: the meeting audio archive lives in the admin's OneDrive.
async function admin(userId: string) {
  if (!(await isAdmin(userId))) throw new MeetingError("Not found.", 404);
}
export function GET(request: Request) {
  return meetingRoute(request, async (userId) => {
    await admin(userId);
    return Response.json({ connected: await onedriveConnected(userId) });
  });
}
// Called after linking: creates the "Audios Breeze" folder, which also proves the token works.
export function POST(request: Request) {
  return meetingRoute(request, async (userId) => {
    await admin(userId);
    await ensureFolder(userId);
    return Response.json({ connected: true });
  });
}
