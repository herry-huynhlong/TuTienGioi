import { NextResponse } from "next/server";
import { prisma } from "@ttg/db";

export async function GET() {
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true, web: "ok", database: "ok", redis: process.env.REDIS_URL ? "configured" : "missing", latencyMs: Date.now() - started });
}
