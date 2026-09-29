import { getUser } from "@/lib/auth";
import { prisma } from "@ttg/db";
import { sendDirectMessage, SocialError } from "@ttg/game";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.character) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const message = await sendDirectMessage(prisma, user.character.id, String(body.receiverId ?? ""), String(body.body ?? ""));
    return NextResponse.json({ ok: true, messageId: message.id });
  } catch (error) {
    if (error instanceof SocialError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
