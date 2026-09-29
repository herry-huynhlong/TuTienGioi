import { getUser } from "@/lib/auth";
import { getRealtimeSnapshot } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user?.character) return new Response("Unauthorized", { status: 401 });
  const characterId = user.character.id;
  const { searchParams } = new URL(request.url);
  const peerId = searchParams.get("with") ?? undefined;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        try {
          const snapshot = await getRealtimeSnapshot(characterId, peerId);
          controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
        } catch (error) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "REALTIME_SNAPSHOT_FAILED" })}\n\n`));
        }
      };

      await send();
      const interval = setInterval(send, 2000);
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
