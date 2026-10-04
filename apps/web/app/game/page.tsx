import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { breakthroughAction, cancelCultivationAction, cultivateAction } from "@/lib/forms";
import { getGameTime, getItemUsageDefinition, getOnboardingState, resolveLocationBackground, resolveLocationImagePosition, settleActiveCultivation, settleCharacterResources } from "@ttg/game";
import Link from "next/link";
import { Check, Circle, Compass, MapPin, ScrollText } from "lucide-react";
import { Activity, ArrowRight, Backpack, BriefcaseBusiness, Clock, Coins, Dumbbell, Gem, Landmark, Mountain, Orbit, Sparkles, TrendingDown, UserRound, type LucideIcon } from "lucide-react";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { GamePageBackground } from "@/components/GamePageBackground";
import { dedupeHeavenBoard, formatAptitude, formatGameDate, formatRealm } from "@/lib/game-display";

export default async function Dashboard({ searchParams }: { searchParams?: Promise<{ error?: string; breakthrough?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  if (user.character?.id) {
    await settleCharacterResources(prisma, user.character.id);
    await settleActiveCultivation(prisma, user.character.id);
  }
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      realmStage: { include: { realm: true } },
      spiritualRoot: true,
      location: true,
      currentLocation: { include: { zone: { include: { region: true } } } },
      cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      trainingJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      craftJobs: { where: { status: "ACTIVE" }, include: { recipe: { include: { outputTemplate: true, profession: true } } }, orderBy: { endsAt: "asc" } },
      explorations: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } },
      travels: { where: { status: "ACTIVE" }, include: { route: { include: { origin: true, destination: true } } }, orderBy: { endsAt: "desc" } },
      sect: true,
      items: { take: 5, include: { template: true }, orderBy: { createdAt: "desc" } },
      quests: { where: { status: { in: ["ACTIVE", "READY_TO_TURN_IN"] } }, include: { template: { include: { turnInNpc: true } } }, orderBy: [{ status: "desc" }, { updatedAt: "desc" }], take: 5 }
    }
  });
  const [news, logs, next, onboarding] = await Promise.all([
    prisma.worldNews.findMany({ take: 30, orderBy: { createdAt: "desc" } }),
    prisma.gameLog.findMany({ where: { characterId: c.id }, take: 6, orderBy: { createdAt: "desc" } }),
    prisma.realmStage.findFirst({
      where: { requiredCultivation: { gt: c.realmStage.requiredCultivation } },
      orderBy: { requiredCultivation: "asc" }
    }),
    getOnboardingState(prisma, c.id)
  ]);
  const breakthroughItems = (await prisma.itemInstance.findMany({
    where: { ownerId: c.id, quantity: { gt: 0 }, equippedSlot: null, listings: { none: { status: "ACTIVE" } }, template: { category: "CONSUMABLE" } },
    include: { template: true },
    orderBy: { createdAt: "desc" }
  })).map((item) => ({ item, usage: getItemUsageDefinition(item.template) })).filter(({ usage }) => usage.action === "BREAKTHROUGH" && usage.effects.some((effect) => effect.type === "BREAKTHROUGH_BONUS"));
  const nextRequirement = next?.requiredCultivation ?? c.realmStage.requiredCultivation;
  const cappedCultivation = c.cultivation > nextRequirement ? nextRequirement : c.cultivation;
  const progress = next ? Number((cappedCultivation * 100n) / next.requiredCultivation) : 100;
  const canBreakthrough = Boolean(next && c.cultivation >= next.requiredCultivation);
  const atCultivationCap = Boolean(next && c.cultivation >= next.requiredCultivation);
  const now = new Date();
  const gameTime = getGameTime(now);
  const locationName = c.currentLocation?.name ?? c.location?.name ?? "Chưa rõ";
  const regionName = c.currentLocation?.zone.region?.name ?? "Chưa rõ địa vực";
  const activeCount = c.cultivationJobs.length + c.explorations.length + c.travels.length;
  const activeWorldCount = c.explorations.length + c.travels.length;
  const activeCultivation = c.cultivationJobs[0];
  const activeTraining = c.trainingJobs[0];
  const activeCultivationReward = activeCultivation?.accumulatedReward ?? 0n;
  const projectedCultivation = cappedCultivation;
  const heroImage = resolveLocationBackground(c.currentLocation);
  const heroPosition = resolveLocationImagePosition(c.currentLocation);
  const locationCultivationBonus = c.currentLocation?.cultivationModifierBps ?? 0;
  const nextAction = getNextAction({ canBreakthrough, quests: c.quests, onboarding });
  const heavenBoard = dedupeHeavenBoard(news);
  const openBreakthroughPanel = params?.breakthrough === "1";

  return (
    <GamePageBackground type="cultivation">
    <div className="dashboard-page p-4 lg:p-6">
      <header
        className={`dashboard-hero hero-${gameTime.phase}`}
        style={{ backgroundImage: `url("${heroImage}")`, backgroundPosition: heroPosition }}
      >
        <div className="dashboard-hero-content">
          <div>
            <p className="text-xs uppercase text-jade">Tu Tiên Giới</p>
            <h1 className="mt-1 text-3xl font-black text-paper">{c.name}</h1>
            <p className="mt-1 text-sm text-paper/75">{formatRealm(c.realmStage.realm, c.realmStage)} · {c.sect?.name ?? c.title}</p>
          </div>
          <div className="dashboard-hero-location">
            <b>{locationName}</b>
            <span>{regionName} · {c.sect?.name ?? "Tán tu"}</span>
            <small>{gameTime.label}</small>
          </div>
        </div>
      </header>
      <ActionAlert message={params?.error} />

      <section className="dashboard-grid">
        <Panel title="Mục Tiêu Hiện Tại" icon={ScrollText} className="lg:col-span-2">
          <div className="quest-tracker">
            {canBreakthrough ? (
              <>
                <div className="dashboard-focus-card">
                  <Sparkles size={20} aria-hidden />
                  <div>
                    <span>Bình cảnh</span>
                    <b>Đột Phá</b>
                    <p>Tu vi đã viên mãn. Hãy chủ động đột phá để mở cảnh giới tiếp theo.</p>
                  </div>
                </div>
                <Link href="/game?breakthrough=1" className="btn mt-4 w-full sm:w-auto">Mở Đột Phá</Link>
              </>
            ) : c.quests.length > 0 ? (
              <>
                <div className="dashboard-focus-card">
                  <ScrollText size={20} aria-hidden />
                  <div>
                    <span>Nhiệm vụ đang theo</span>
                    <b>{c.quests[0]?.template.title}</b>
                    <p>{c.quests[0]?.status === "READY_TO_TURN_IN" ? "Có thể nộp nhiệm vụ." : `Tiến độ ${c.quests[0]?.progress ?? 0}/${c.quests[0]?.targetCount ?? 0}`}</p>
                  </div>
                  <Link href="/game/quests" className="status-pill">Mở</Link>
                </div>
                <div className="mt-4 grid gap-2">
                  {c.quests.slice(0, 3).map((quest) => (
                    <Link key={quest.id} href={quest.status === "READY_TO_TURN_IN" && quest.template.turnInNpc ? `/game/npc/${quest.template.turnInNpc.key}` : "/game/quests"} className="objective-row">
                      {quest.status === "READY_TO_TURN_IN" ? <Check size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
                      <span>{quest.template.title} · {quest.status === "READY_TO_TURN_IN" ? "Có thể nộp" : `${quest.progress}/${quest.targetCount}`}</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="dashboard-focus-card">
                  <Compass size={20} aria-hidden />
                  <div>
                    <span>Chỉ dẫn</span>
                    <b>{onboarding.currentChapter.title}</b>
                    <p>{onboarding.currentChapter.summary}</p>
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
              </>
            )}
          </div>
        </Panel>

        <Panel title="Hiện Trạng" icon={Activity} className="lg:col-span-2">
          <div className="dashboard-status-grid">
            <StatusCard icon={Mountain} label="Cảnh giới" value={formatRealm(c.realmStage.realm, c.realmStage)} />
            <StatusCard icon={Gem} label="Linh căn" value={formatAptitude(c.spiritualRoot)} />
            <StatusCard icon={Landmark} label="Tông môn" value={c.sect?.name ?? "Tán tu"} />
            <StatusCard icon={Activity} label="Hoạt động" value={activeCultivation ? "Đang nhập định" : activeWorldCount > 0 ? `${activeWorldCount} việc đang diễn ra` : "Đang rảnh"} accent={activeCount > 0} />
            <StatusCard icon={MapPin} label="Vị trí" value={locationName} />
            <StatusCard icon={Coins} label="Linh thạch" value={<CurrencyAmount amount={c.linhThach} />} accent />
          </div>
        </Panel>

        <Panel title="Việc nên làm tiếp" icon={Compass} className="lg:col-span-2">
          <div className="dashboard-action-list">
            <Link href={nextAction.href} className="dashboard-action-card">
              <ScrollText size={18} aria-hidden />
              <span><b>{nextAction.title}</b><small>{nextAction.description}</small></span>
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/game/world" className="dashboard-action-card">
              <MapPin size={18} aria-hidden />
              <span><b>Xem bản đồ</b><small>{locationName} · {regionName}</small></span>
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/game/character" className="dashboard-action-card">
              <UserRound size={18} aria-hidden />
              <span><b>Xem nhân vật</b><small>Công pháp, thiên phú, trang bị và túi đồ</small></span>
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </Panel>

        <Panel title="Tu luyện" icon={Orbit} className="lg:col-span-2">
          <div className="cultivation-overview">
            <div>
              <span>{formatRealm(c.realmStage.realm, c.realmStage)} {next ? `→ ${next.name}` : ""}</span>
              <b>{projectedCultivation.toString()} / {nextRequirement.toString()}</b>
            </div>
            {locationCultivationBonus < 0 ? <em className="debuff"><TrendingDown size={14} aria-hidden /> Linh khí địa điểm {Math.round(locationCultivationBonus / 100)}%</em> : <em>Linh khí địa điểm {locationCultivationBonus ? `${locationCultivationBonus > 0 ? "+" : ""}${Math.round(locationCultivationBonus / 100)}%` : "bình thường"}</em>}
          </div>
          <div className="resource-track mt-3 h-3">
            <div className="resource-fill resource-cultivation" style={{ width: `${Math.min(100, activeCultivation ? Number((projectedCultivation * 100n) / nextRequirement) : progress)}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-paper/55">
            <span>{atCultivationCap ? "Cần Đột phá để tiếp tục." : `Còn ${(nextRequirement - cappedCultivation).toString()} Tu vi tới bình cảnh`}</span>
            <span>{locationCultivationBonus ? `Linh khí địa điểm ${locationCultivationBonus > 0 ? "+" : ""}${Math.round(locationCultivationBonus / 100)}%` : "Linh khí địa điểm bình thường"}</span>
          </div>
          {activeCultivation ? (
            <div className="bottleneck-box mt-4">
              <b>Đang nhập định</b>
              <p>Thời gian tu luyện: {formatRealDuration(now.getTime() - activeCultivation.startedAt.getTime())} · Tu vi đã tích lũy: +{activeCultivationReward.toString()}</p>
            </div>
          ) : !canBreakthrough ? (
            <p className="muted mt-4 text-sm">Tu vi chưa viên mãn.</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {activeCultivation ? (
              <form action={cancelCultivationAction}>
                <input type="hidden" name="id" value={activeCultivation.id} />
                <button className="btn btn-secondary">Dừng & Nhận Tu Vi</button>
              </form>
            ) : canBreakthrough ? (
              <Link href="/game?breakthrough=1" className="btn">Đột Phá</Link>
            ) : (
              <form action={cultivateAction}>
                <button className="btn" disabled={activeWorldCount > 0}>Tu Luyện</button>
              </form>
            )}
          </div>
          {openBreakthroughPanel ? (
            <div className="cultivation-panel mt-4">
              <b>Đột Phá</b>
              {canBreakthrough ? (
                <form action={breakthroughAction} className="mt-3 grid gap-3 sm:max-w-md">
                  <BreakthroughSupportSelect items={breakthroughItems} compact />
                  <button className="btn">Đột Phá</button>
                </form>
              ) : (
                <p className="muted mt-2 text-sm">Tu vi chưa viên mãn.</p>
              )}
            </div>
          ) : null}
        </Panel>

        <Panel title="Hoạt động đang chạy" icon={Clock} className="lg:col-span-2">
          <div className="activity-list">
            {activeCultivation ? (
              <div className="activity-row activity-row-rich">
                <Sparkles size={18} aria-hidden />
                <span><b>Tu luyện</b><small>Đang nhập định · tích lũy +{activeCultivationReward.toString()} Tu vi</small></span>
                <Link href="/game" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Xem</Link>
              </div>
            ) : null}
            {activeTraining ? (
              <div className="activity-row activity-row-rich">
                <Dumbbell size={18} aria-hidden />
                <span><b>Rèn luyện</b><small>Kết thúc {activeTraining.endsAt.toLocaleString("vi-VN")}</small></span>
                <Link href="/game/training" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Xem</Link>
              </div>
            ) : null}
            {c.craftJobs.map((job) => (
              <div key={job.id} className="activity-row activity-row-rich">
                <BriefcaseBusiness size={18} aria-hidden />
                <span><b>Chế tạo</b><small>{job.recipe.name} · {job.endsAt <= now ? "đã hoàn thành" : `xong ${job.endsAt.toLocaleString("vi-VN")}`}</small></span>
                <Link href="/game/profession" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Xem</Link>
              </div>
            ))}
            {c.explorations.map((job) => (
              <div key={job.id} className="activity-row activity-row-rich">
                <Backpack size={18} aria-hidden />
                <span><b>Lịch luyện</b><small>Kết thúc {job.endsAt.toLocaleString("vi-VN")}</small></span>
                <Link href="/game/location" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Xem</Link>
              </div>
            ))}
            {c.travels.map((travel) => (
              <div key={travel.id} className="activity-row activity-row-rich">
                <MapPin size={18} aria-hidden />
                <span><b>Di chuyển</b><small>{travel.route.origin.name} -&gt; {travel.route.destination.name}</small></span>
                <Link href="/game/world" className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Xem</Link>
              </div>
            ))}
            {activeWorldCount === 0 && !activeCultivation && !activeTraining && c.craftJobs.length === 0 ? <div className="dashboard-empty-state"><Clock size={20} aria-hidden /><span><b>Không có hoạt động đang diễn ra.</b><small>Tu luyện, rèn luyện hoặc chế tạo sẽ xuất hiện tại đây khi đang chạy.</small></span></div> : null}
          </div>
        </Panel>

        <Panel title="Thiên Đạo Bảng" icon={Sparkles} className="lg:col-span-2">
          <div className="heaven-feed">
            {heavenBoard.map((n) => <div key={n.id}><Sparkles size={14} aria-hidden /><p><b>{formatGameDate(n.createdAt)}</b><span>{n.title}</span></p></div>)}
            {heavenBoard.length === 0 ? <p className="muted">Thiên hạ tạm thời yên ổn.</p> : null}
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
            <Link href="/game/location">Địa điểm</Link>
            <Link href="/game/character">Nhân vật</Link>
            <Link href="/game/leaderboard">Xếp hạng</Link>
          </div>
        </Panel>
      </section>
    </div>
    </GamePageBackground>
  );
}

function Panel({ title, icon: Icon, children, className = "" }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="dash-panel-title">{Icon ? <Icon size={15} aria-hidden /> : null}{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusCard({ icon: Icon, label, value, accent = false }: { icon: LucideIcon; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={accent ? "dashboard-status-card accent" : "dashboard-status-card"}>
      <Icon size={17} aria-hidden />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function BreakthroughSupportSelect({ items, compact = false }: { items: Array<{ item: { id: string; quantity: number; template: { name: string } }; usage: ReturnType<typeof getItemUsageDefinition> }>; compact?: boolean }) {
  if (items.length === 0) return <p className="muted text-sm">Không có đan dược hỗ trợ đột phá trong túi.</p>;
  return (
    <label className={`grid gap-2 ${compact ? "text-sm" : ""}`}>
      <span className="font-bold text-gold">Đan hỗ trợ</span>
      <select name="supportItemInstanceId" className="form-input">
        <option value="">Không dùng vật phẩm</option>
        {items.map(({ item, usage }) => {
          const bonus = usage.effects.find((effect) => effect.type === "BREAKTHROUGH_BONUS");
          const bps = typeof bonus?.payload.bps === "number" ? bonus.payload.bps : 0;
          const penalty = typeof bonus?.payload.failurePenaltyReductionBps === "number" ? bonus.payload.failurePenaltyReductionBps : 0;
          return (
            <option key={item.id} value={item.id}>
              {item.template.name} x{item.quantity} · +{Math.round(bps / 100)}%{penalty ? ` · giảm hao tổn ${Math.round(penalty / 100)}%` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function getNextAction({ canBreakthrough, quests, onboarding }: { canBreakthrough: boolean; quests: Array<{ status: string; template: { title: string; turnInNpc: { key: string } | null } }>; onboarding: Awaited<ReturnType<typeof getOnboardingState>> }) {
  const readyQuest = quests.find((quest) => quest.status === "READY_TO_TURN_IN");
  const activeQuest = quests[0];
  if (canBreakthrough) return { href: "/game", title: "Đột phá", description: "Tu vi đã viên mãn, hãy thử đột phá cảnh giới." };
  if (readyQuest?.template.turnInNpc) return { href: `/game/npc/${readyQuest.template.turnInNpc.key}`, title: "Nộp nhiệm vụ", description: readyQuest.template.title };
  if (activeQuest) return { href: "/game/quests", title: "Tiếp tục nhiệm vụ", description: activeQuest.template.title };
  return { href: onboarding.nextObjective.href, title: onboarding.nextObjective.cta, description: onboarding.nextObjective.label };
}

function formatRealDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.round(hours / 24);
  return `${days} ngày`;
}

