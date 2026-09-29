import { audioRedirect, meetingRoute } from "@/lib/meetings";
export const runtime = "nodejs";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return meetingRoute(request, async (userId) => audioRedirect((await context.params).id, userId));
}
