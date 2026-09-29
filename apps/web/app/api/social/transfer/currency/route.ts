import { getUser } from "@/lib/auth";
import { prisma } from "@ttg/db";
import { sendFriendCurrency, SocialError } from "@ttg/game";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.character) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const raw = String(body.amount ?? "0").trim();
  if (!/^\d+$/.test(raw)) return NextResponse.json({ error: "Số Linh Thạch không hợp lệ." }, { status: 400 });
  try {
    const transfer = await sendFriendCurrency(prisma, user.character.id, String(body.receiverId ?? ""), BigInt(raw), String(body.transactionKey ?? ""));
    return NextResponse.json({ ok: true, transferId: transfer.id });
  } catch (error) {
    if (error instanceof SocialError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
