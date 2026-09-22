import { getAudio, meetingRoute } from "@/lib/meetings";
export const runtime = "nodejs";
export function GET(request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  return meetingRoute(request, async (userId) => {
    const { id, index } = await context.params;
    return getAudio(id, userId, index, request);
  });
}
