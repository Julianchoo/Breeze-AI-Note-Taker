import { getSharedAudio, shareRoute } from "@/lib/meetings";
export const runtime = "nodejs";
export function GET(request: Request, context: { params: Promise<{ token: string; index: string }> }) {
  return shareRoute(async () => {
    const { token, index } = await context.params;
    return getSharedAudio(token, index, request);
  });
}
