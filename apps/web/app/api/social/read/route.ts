import { getUser } from "@/lib/auth";
import { prisma } from "@ttg/db";
import { markConversationRead } from "@ttg/game";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.character) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const conversationId = String(body.conversationId ?? "");
  if (!conversationId) return NextResponse.json({ error: "BAD_CONVERSATION" }, { status: 400 });
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ memberAId: user.character.id }, { memberBId: user.character.id }]
    }
  });
  if (!conversation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await markConversationRead(prisma, user.character.id, conversation.id);
  return NextResponse.json({ ok: true });
}
