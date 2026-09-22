import { meetingRoute, uploadChunk } from "@/lib/meetings";
export const runtime = "nodejs";
export const maxDuration = 60;
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return meetingRoute(request, async (userId) =>
    Response.json(await uploadChunk((await context.params).id, userId, request))
  );
}
