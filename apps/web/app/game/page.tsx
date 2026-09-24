import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { breakthroughAction, claimCultivationAction, cultivateAction } from "@/lib/forms";
import { currentEnergy, getOnboardingState } from "@ttg/game";
import Link from "next/link";
import { Check, Circle, Compass, MapPin, ScrollText } from "lucide-react";

export default async function Dashboard() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      realmStage: { include: { realm: true } },
      spiritualRoot: true,
      location: true,
      currentLocation: { include: { zone: { include: { region: true } } } },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      explorations: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      travels: { where: { status: "ACTIVE" }, include: { route: { include: { origin: true, destination: true } } }, orderBy: { endsAt: "desc" } },
      sect: true,
      items: { take: 5, include: { template: true }, orderBy: { createdAt: "desc" } }
    }
  });
  const [news, logs, next, onboarding] = await Promise.all([
    prisma.worldNews.findMany({ take: 7, orderBy: { createdAt: "desc" } }),
    prisma.gameLog.findMany({ where: { characterId: c.id }, take: 6, orderBy: { createdAt: "desc" } }),
    prisma.realmStage.findFirst({
      where: { requiredCultivation: { gt: c.realmStage.requiredCultivation } },
      orderBy: { requiredCultivation: "asc" }
    }),
    getOnboardingState(prisma, c.id)
  ]);
  const energy = currentEnergy(c);
  const nextRequirement = next?.requiredCultivation ?? c.realmStage.requiredCultivation;
  const progress = next ? Number((c.cultivation * 100n) / next.requiredCultivation) : 100;
  const locationName = c.currentLocation?.name ?? c.location?.name ?? "Chưa rõ";
  const regionName = c.currentLocation?.zone.region?.name ?? "Chưa rõ địa vực";
  return (
    <div className="dashboard-page p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-jade">Bảng điều khiển</p>
          <h1 className="mt-1 text-3xl font-black text-paper">{c.name}</h1>
          <p className="muted mt-1 text-sm">/@{user!.username} · {c.title}</p>
        </div>
        <div className="text-left text-sm text-paper/75 sm:text-right">
          <b className="text-gold">{locationName}</b>
          <br />
          {regionName} · {c.sect?.name ?? "Tán tu"}
        </div>
      </header>

      <section className="dashboard-grid">
        <Panel title="Dẫn Đạo" className="lg:col-span-2">
          <div className="quest-tracker">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gold">{onboarding.currentChapter.title}</p>
                <p className="muted mt-1 text-sm">{onboarding.currentChapter.summary}</p>
              </div>
              <span className="status-pill">{onboarding.completedCount}/{onboarding.totalCount}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {onboarding.currentChapter.objectives.map((objective) => (
                <div key={objective.key} className="objective-row">
                  {objective.completed ? <Check size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
                  <span>{objective.label}</span>
                </div>
              ))}
            </div>
            <Link href={onboarding.nextObjective.href} className="btn mt-4 w-full sm:w-auto">
              <Compass size={16} aria-hidden /> {onboarding.nextObjective.cta}
            </Link>
          </div>
        </Panel>

        <Panel title="Việc nên làm tiếp" className="lg:col-span-2">
          <div className="activity-list">
            <Link href={onboarding.nextObjective.href} className="activity-row">
              <span><b>{onboarding.nextObjective.cta}</b><small>{onboarding.nextObjective.label}</small></span>
              <ScrollText size={17} aria-hidden />
            </Link>
            <Link href="/game/world" className="activity-row">
              <span><b>Kiểm tra vị trí</b><small>{locationName} · {regionName}</small></span>
              <MapPin size={17} aria-hidden />
            </Link>
          </div>
        </Panel>

        <Panel title="Tổng quan" className="lg:col-span-2">
          <div className="info-table">
            <Info label="Tên" value={c.name} />
            <Info label="Cảnh giới" value={`${c.realmStage.realm.name} ${c.realmStage.name}`} />
            <Info label="Linh căn" value={c.spiritualRoot.name} />
            <Info label="Tông môn" value={c.sect?.name ?? "Tán tu"} />
            <Info label="Vị trí" value={locationName} />
            <Info label="Linh thạch" value={c.linhThach.toString()} accent />
          </div>
        </Panel>

        <Panel title="Sinh mệnh">
          <div className="compact-bars">
            <MiniBar label="HP" value={c.hp} max={c.maxHp} tone="life" />
            <MiniBar label="Chân nguyên" value={c.qi} max={c.maxQi} tone="qi" />
            <MiniBar label="Thể lực" value={energy} max={c.energyMax} tone="energy" />
          </div>
        </Panel>

        <Panel title="Chiến lực">
          <div className="info-table">
            <Info label="Công kích" value={c.attack.toString()} />
            <Info label="Phòng ngự" value={c.defense.toString()} />
            <Info label="Tốc độ" value={c.speed.toString()} />
            <Info label="Khí vận" value={c.luck.toString()} />
          </div>
        </Panel>

        <Panel title="Tu luyện" className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="muted">Tiến độ tới mốc kế tiếp</span>
            <b className="text-gold">{Math.min(100, progress)}%</b>
          </div>
          <div className="resource-track h-3">
            <div className="resource-fill resource-cultivation" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-paper/55">
            <span>{c.cultivation.toString()} tu vi</span>
            <span>{next ? `${nextRequirement.toString()} cần thiết` : "Đã tới giới hạn hiện tại"}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {[10, 30, 60, 240, 480].map((m) => (
              <form key={m} action={cultivateAction}>
                <input type="hidden" name="minutes" value={m} />
                <button className="btn btn-secondary w-full">{m >= 60 ? `${m / 60}h` : `${m}p`}</button>
              </form>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={breakthroughAction}><button className="btn">Đột phá</button></form>
            <Link href="/game/character" className="btn btn-secondary">Nhân vật</Link>
          </div>
        </Panel>

        <Panel title="Hoạt động đang chạy" className="lg:col-span-2">
          <div className="activity-list">
            {c.cultivationJobs.map((job) => (
              <form key={job.id} action={claimCultivationAction} className="activity-row">
                <input type="hidden" name="id" value={job.id} />
                <span><b>Bế quan</b><small>Kết thúc {job.endsAt.toLocaleString("vi-VN")}</small></span>
                <button className="btn min-h-0 px-3 py-1 text-xs">Nhận</button>
              </form>
            ))}
            {c.explorations.map((job) => (
              <div key={job.id} className="activity-row">
                <span><b>Thám hiểm</b><small>Kết thúc {job.endsAt.toLocaleString("vi-VN")}</small></span>
                <Link href="/game/world" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Xem</Link>
              </div>
            ))}
            {c.travels.map((travel) => (
              <div key={travel.id} className="activity-row">
                <span><b>Di chuyển</b><small>{travel.route.origin.name} → {travel.route.destination.name}</small></span>
                <Link href="/game/world" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Hoàn tất</Link>
              </div>
            ))}
            {c.cultivationJobs.length + c.explorations.length + c.travels.length === 0 ? <p className="muted">Không có hoạt động nào đang chạy.</p> : null}
          </div>
        </Panel>

        <Panel title="Thiên Đạo Bảng" className="lg:col-span-2">
          <div className="event-list">
            {news.map((n) => <p key={n.id}>{n.title}</p>)}
            {news.length === 0 ? <p className="muted">Chưa có tin tức mới.</p> : null}
          </div>
        </Panel>

        <Panel title="Nhật ký cá nhân" className="lg:col-span-2">
          <div className="event-list">
            {logs.map((log) => <p key={log.id}>{log.message}</p>)}
            {logs.length === 0 ? <p className="muted">Chưa có ghi chép hành động.</p> : null}
          </div>
        </Panel>

        <Panel title="Túi đồ gần đây">
          <div className="event-list">
            {c.items.map((item) => <p key={item.id}>{item.template.name} x{item.quantity}</p>)}
            {c.items.length === 0 ? <p className="muted">Túi đồ đang trống.</p> : null}
          </div>
        </Panel>

        <Panel title="Lối tắt">
          <div className="quick-links">
            <Link href="/game/world">Thế giới</Link>
            <Link href="/game/market">Chợ</Link>
            <Link href="/game/sect">Tông môn</Link>
            <Link href="/game/leaderboard">Xếp hạng</Link>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="dash-panel-title">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <b className={accent ? "text-gold" : ""}>{value}</b>
    </div>
  );
}

function MiniBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "life" | "qi" | "energy" }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-paper/70"><span>{label}</span><b>{value}/{max}</b></div>
      <div className="resource-track">
        <div className={`resource-fill resource-${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
