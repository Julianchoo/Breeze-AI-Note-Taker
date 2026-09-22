import { deleteMeeting, getMeeting, meetingRoute, updateMeeting } from "@/lib/meetings";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return meetingRoute(request, async (userId) =>
    Response.json(await getMeeting((await context.params).id, userId))
  );
}
export function PATCH(request: Request, context: Context) {
  return meetingRoute(request, async (userId) =>
    Response.json({
      meeting: await updateMeeting((await context.params).id, userId, await request.json()),
    })
  );
}
export function DELETE(request: Request, context: Context) {
  return meetingRoute(request, async (userId) => {
    await deleteMeeting((await context.params).id, userId);
    return Response.json({ deleted: true });
  });
}
