import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { claimExploreAction, exploreAction } from "@/lib/forms";
import { explorationEnergyCost, recordOnboardingEvent } from "@ttg/game";
import Link from "next/link";

const exploreOptions = [
  { minutes: 10, risk: "Thấp", reward: "Dấu vết nhỏ" },
  { minutes: 30, risk: "Trung bình", reward: "Tài nguyên khá hơn" },
  { minutes: 60, risk: "Cao", reward: "Cơ duyên tốt hơn" }
];

const activityLabels: Record<string, string> = {
  market: "Chợ",
  auction: "Đấu giá",
  npc_shop: "Cửa hàng NPC",
  inn: "Khách điếm",
  mail: "Thư tín",
  travel: "Dịch trạm",
  caravan: "Tiêu cục",
  explore: "Khám phá",
  pve: "Săn yêu",
  resource: "Thu thập",
  encounter: "Điều tra",
  formation: "Trận pháp",
  secret: "Bí cảnh",
  forging: "Luyện khí"
};

export default async function LocationPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      explorations: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      currentLocation: { include: { zone: { include: { region: true } } } },
      location: true
    }
  });
  await recordOnboardingEvent(prisma, c.id, "VIEW_WORLD");
  const location = c.currentLocation;
  const services = location?.services ?? [];
  const canExplore = services.includes("explore") || services.includes("pve");
  const logs = await prisma.gameLog.findMany({
    where: { characterId: c.id, type: { in: ["exploration", "encounter"] } },
    take: 6,
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Location</p>
          <h1 className="mt-1 text-3xl font-black">{location?.name ?? c.location?.name ?? "Vô định"}</h1>
          <p className="muted mt-2">{location?.zone.region?.name ?? "Chưa rõ địa vực"} · {location?.zone.name ?? "Chưa rõ khu vực"}</p>
        </div>
        <Link href="/game/world" className="btn btn-secondary">Xem Thế Giới</Link>
      </header>

      <section className="location-hero">
        <div>
          <p className="text-xs font-bold uppercase text-jade">Địa điểm hiện tại</p>
          <h2>{location?.name ?? "Chưa rõ"}</h2>
          <p className="muted mt-2">{location?.description ?? "Chưa có mô tả địa điểm."}</p>
        </div>
        <div className="location-meta">
          <span><b>Loại</b>{location?.kind ?? "Không rõ"}</span>
          <span><b>An ninh</b>{location?.securityLevel ?? "Không rõ"}</span>
          <span><b>Hoạt động</b>{services.length ? services.map((service) => activityLabels[service] ?? service).join(", ") : "Chưa mở"}</span>
          <span><b>Yêu thú</b>{canExplore ? "Có thể gặp qua hoạt động" : "Không xuất hiện trong khu này"}</span>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel title="Hoạt động tại đây">
          {canExplore ? (
            <div className="action-grid">
              {exploreOptions.map((option) => (
                <form key={option.minutes} action={exploreAction} className="action-card">
                  <input type="hidden" name="minutes" value={option.minutes} />
                  <div>
                    <b>{option.minutes} phút</b>
                    <small>Tốn {explorationEnergyCost(option.minutes)} thể lực · Nguy hiểm {option.risk}</small>
                  </div>
                  <p className="muted text-sm">{option.reward}. Yêu thú chỉ xuất hiện nếu hoạt động tạo encounter.</p>
                  <button className="btn btn-secondary w-full">Khám phá</button>
                </form>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>Khu này không phải ngoại vực.</b>
              <p>Ở đây chủ yếu dùng các dịch vụ an toàn như giao dịch, nghỉ ngơi hoặc di chuyển. Muốn săn yêu, hãy mở bản đồ và đi tới rừng, núi, cốc hoặc bí cảnh.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {services.includes("market") ? <Link href="/game/market" className="btn btn-secondary">Mở Chợ</Link> : null}
                <Link href="/game/world" className="btn">Chọn địa điểm khác</Link>
              </div>
            </div>
          )}

          {c.explorations.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {c.explorations.map((e) => (
                <form key={e.id} action={claimExploreAction} className="activity-row">
                  <input type="hidden" name="id" value={e.id} />
                  <span><b>Hoạt động đang chạy</b><small>Kết thúc {e.endsAt.toLocaleString("vi-VN")}</small></span>
                  <button className="btn min-h-0 px-3 py-1 text-xs">Nhận</button>
                </form>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel title="Nhật ký địa điểm">
          <div className="event-list">
            {logs.map((log) => <p key={log.id}>{log.message}</p>)}
            {logs.length === 0 ? <p className="muted">Chưa có ghi chép tại địa điểm này.</p> : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
