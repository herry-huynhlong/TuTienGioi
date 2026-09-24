import { Redis } from "ioredis";
import { prisma } from "@ttg/db";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { lazyConnect: true, maxRetriesPerRequest: 2 });

async function refreshLeaderboards() {
  const rows = await prisma.character.findMany({
    take: 100,
    orderBy: [{ cultivation: "desc" }, { reputation: "desc" }],
    select: { id: true, name: true, cultivation: true, reputation: true }
  });
  await redis.set("leaderboard:cultivation", JSON.stringify(rows.map((r) => ({ ...r, cultivation: r.cultivation.toString() }))), "EX", 180);
}

async function expireMarketsAndAuctions() {
  const now = new Date();
  await prisma.marketListing.updateMany({ where: { status: "ACTIVE", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
  const auctions = await prisma.auction.findMany({ where: { status: "ACTIVE", endsAt: { lt: now } }, take: 50 });
  for (const auction of auctions) {
    await prisma.auction.update({ where: { id: auction.id }, data: { status: "SETTLED" } });
    await prisma.worldNews.create({ data: { title: "Một phiên đấu giá khép lại", body: `Đấu giá ${auction.id} đã kết thúc.`, category: "auction" } });
  }
}

async function spawnWorldEvent() {
  const active = await prisma.worldEvent.findFirst({ where: { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } } });
  if (active) return;
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60_000);
  await prisma.worldEvent.create({ data: { key: "linh-khi-trieu-tich", title: "Linh Khí Triều Tịch", kind: "weather", startsAt, endsAt, modifiers: { cultivationBps: 300 } } });
  await prisma.worldNews.create({ data: { title: "Linh Khí Triều Tịch xuất hiện", body: "Linh khí trong thiên địa dâng lên, tu luyện thuận lợi hơn trong thời gian ngắn.", category: "event" } });
}

async function tick() {
  await redis.connect().catch(() => undefined);
  await Promise.all([refreshLeaderboards(), expireMarketsAndAuctions(), spawnWorldEvent()]);
  console.log(JSON.stringify({ level: "info", msg: "worker_tick", at: new Date().toISOString() }));
}

tick().catch((error) => console.error(JSON.stringify({ level: "error", msg: "worker_failed", error: String(error) })));
setInterval(() => tick().catch((error) => console.error(JSON.stringify({ level: "error", msg: "worker_failed", error: String(error) }))), 60_000);
