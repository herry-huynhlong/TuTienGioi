import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FacilityPage, FacilityPanel, FacilityTutorial } from "@/components/FacilityPage";
import { GamePageBackground } from "@/components/GamePageBackground";
import { formatRarity, formatService } from "@/lib/format";
import { claimCraftAction, startCraftAction } from "@/lib/forms";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { ItemVisual } from "@/components/ItemCard";
import { professionFacilityFor, professionFacilityNames, professionFacilityRoleLabels } from "@/lib/profession-facilities";
import { calculateCraftSuccessChance, economyFeatureUnlockReasons, hasReachedLuyenKhi1, nextMasteryThreshold, professionFacilitySuccessBonusBps, professionRankExpThresholds, professionRankLabels, professionRankOrder, professionRanks, professionStationServices, resolveProfessionFacilityGrade } from "@ttg/game";
import { AlertCircle, CheckCircle2, Clock, FlaskConical, Grid3X3, Hammer, Lock, MapPin, PackageCheck, Play, ScrollText, Sparkles, Star, Timer, type LucideIcon } from "lucide-react";

type IngredientRow = { itemId?: unknown; key?: unknown; quantity?: unknown; qty?: unknown };

const professionIconMap: Record<string, LucideIcon> = {
  alchemy: FlaskConical,
  forging: Hammer,
  talisman: ScrollText,
  formation: Grid3X3
};

const stationIconMap: Record<string, LucideIcon> = {
  ALCHEMY_FURNACE: FlaskConical,
  FORGE: Hammer,
  TALISMAN_TABLE: ScrollText,
  FORMATION_ALTAR: Grid3X3
};

export default async function ProfessionPage({ searchParams }: { searchParams?: Promise<{ profession?: string; error?: string; ok?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  const [c, professions] = await Promise.all([
    prisma.character.findUniqueOrThrow({
      where: { userId: user.id },
      include: {
        realmStage: { include: { realm: true } },
        currentLocation: true,
        items: { where: { quantity: { gt: 0 } }, select: { templateId: true, quantity: true } },
        professions: { include: { profession: true } },
        craftJobs: { where: { status: "ACTIVE" }, include: { recipe: { include: { outputTemplate: true, profession: true } } }, orderBy: { endsAt: "asc" } }
      }
    }),
    prisma.profession.findMany({
      where: { key: { in: ["alchemy", "forging", "talisman", "formation"] } },
      include: { recipes: { include: { outputTemplate: true }, orderBy: [{ requiredRank: "asc" }, { requiredLevel: "asc" }, { name: "asc" }] } },
      orderBy: { key: "asc" }
    })
  ]);
  if (!hasReachedLuyenKhi1(c)) redirect(`/game?error=${encodeURIComponent(economyFeatureUnlockReasons.profession)}`);
  const professionOrder = ["alchemy", "forging", "talisman", "formation"];
  professions.sort((a, b) => professionOrder.indexOf(a.key) - professionOrder.indexOf(b.key));
  const activeProfession = professions.find((profession) => profession.key === params?.profession) ?? professions[0];
  if (!activeProfession) return null;
  const characterProfession = c.professions.find((entry) => entry.professionId === activeProfession.id);
  const currentRank = characterProfession?.rank ?? "APPRENTICE";
  const currentOrder = professionRankOrder(currentRank);
  const nextRank = professionRanks[currentOrder + 1] ?? null;
  const visibleRanks = new Set([currentRank, ...(nextRank ? [nextRank] : [])]);
  const visibleRecipes = activeProfession.recipes.filter((recipe) => visibleRanks.has(recipe.requiredRank));
  const chanceWording = craftChanceWording(activeProfession.key);
  const ingredientIds = [...new Set(visibleRecipes.flatMap((recipe) => ingredientRows(recipe.ingredients).map((row) => String(row.itemId ?? "")).filter(Boolean)))];
  const neededServices = [...new Set(visibleRecipes.flatMap((recipe) => professionStationServices[recipe.station] ?? []))];
  const [ingredientTemplates, stationLocations, masteries] = await Promise.all([
    ingredientIds.length ? prisma.itemTemplate.findMany({ where: { id: { in: ingredientIds } } }) : [],
    neededServices.length ? prisma.location.findMany({ where: { services: { hasSome: neededServices } }, select: { key: true, name: true, services: true }, orderBy: { name: "asc" }, take: 20 }) : [],
    prisma.craftRecipeMastery.findMany({ where: { characterId: c.id, recipeId: { in: visibleRecipes.map((recipe) => recipe.id) } } })
  ]);
  const ingredientById = new Map(ingredientTemplates.map((item) => [item.id, item]));
  const masteryByRecipeId = new Map(masteries.map((mastery) => [mastery.recipeId, mastery]));
  const ownedByTemplateId = new Map<string, number>();
  for (const item of c.items) ownedByTemplateId.set(item.templateId, (ownedByTemplateId.get(item.templateId) ?? 0) + item.quantity);
  const services = c.currentLocation?.services ?? [];
  const hasActiveCraft = c.craftJobs.length > 0;

  return (
    <GamePageBackground type="profession">
    <FacilityPage eyebrow="Nghề nghiệp" title="Công Xưởng Tu Tiên" description="Chọn nghề, đứng đúng cơ sở nghề và chế tạo vật phẩm theo công thức đã mở.">
      {params?.error ? <div className="action-alert error">{params.error}</div> : null}
      <FacilityTutorial title="Hướng dẫn Nghề Nghiệp">
        Chọn nghề, kiểm tra bậc nghề và đứng đúng cơ sở. Khi bắt đầu chế tạo, nguyên liệu và Linh Thạch bị trừ ngay; khi hoàn thành hãy nhận thành phẩm vào Ba Lô để lấy EXP nghề.
      </FacilityTutorial>

      <section className="profession-tabs">
        {professions.map((profession) => {
          const entry = c.professions.find((row) => row.professionId === profession.id);
          const rank = entry?.rank ?? "APPRENTICE";
          const Icon = professionIconMap[profession.key] ?? Sparkles;
          return (
            <a key={profession.id} href={`/game/profession?profession=${profession.key}`} className={profession.id === activeProfession.id ? "active" : ""}>
              <Icon size={18} aria-hidden />
              <b>{profession.name}</b>
              <span>{professionFacilityRoleLabels[profession.key] ?? "Cần: Cơ sở nghề"} · {professionRankLabels[rank]} · {entry?.experience ?? 0} EXP</span>
            </a>
          );
        })}
      </section>

      <section className="mt-4 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <FacilityPanel title="Cây bậc nghề" subtitle={activeProfession.name}>
          <ProfessionRankTrack currentOrder={currentOrder} experience={characterProfession?.experience ?? 0} />
          <div className="info-table mt-4">
            <div><span>Địa điểm</span><b>{c.currentLocation?.name ?? "Vô định"}</b></div>
            <div><span>Cơ sở hiện có</span><b>{services.length ? services.map(formatService).join(", ") : "Không"}</b></div>
            <div><span>Bậc hiện tại</span><b>{professionRankLabels[currentRank]}</b></div>
          </div>
        </FacilityPanel>

        <FacilityPanel title="Việc đang chạy" subtitle={`${c.craftJobs.length} việc`}>
          {c.craftJobs.length > 0 ? (
            <div className="activity-list">
              {c.craftJobs.map((job) => {
                const ready = job.endsAt.getTime() <= Date.now();
                const totalMs = Math.max(1, job.endsAt.getTime() - job.startedAt.getTime());
                const elapsedMs = Math.max(0, Date.now() - job.startedAt.getTime());
                const progress = ready ? 100 : Math.min(100, Math.round((elapsedMs / totalMs) * 100));
                return (
                  <div key={job.id} className="profession-job-card">
                    <ItemVisual template={job.recipe.outputTemplate} size="card" />
                    <div className="profession-job-main">
                      <span className={ready ? "profession-job-state ready" : "profession-job-state"}>{ready ? "Hoàn thành" : "Đang chế tạo"}</span>
                      <b>{job.recipe.name}</b>
                      <small>{job.recipe.profession.name} · tạo {job.recipe.outputTemplate.name}</small>
                      <div className="profession-job-progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
                      <small>{ready ? "Có thể nhận thành phẩm." : `Còn ${formatDuration(job.endsAt.getTime() - Date.now())}`}</small>
                    </div>
                    <form action={claimCraftAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button className="btn btn-secondary min-h-0 px-3 py-1 text-xs" disabled={!ready}>
                        {ready ? <PackageCheck size={14} aria-hidden /> : <Clock size={14} aria-hidden />} {ready ? "Nhận" : "Đang luyện"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <b>Không có việc chế tạo đang chạy.</b>
              <p>Hãy chọn một công thức đã mở để bắt đầu.</p>
            </div>
          )}
        </FacilityPanel>
      </section>

      <FacilityPanel title="Công thức bậc hiện tại và kế tiếp" subtitle={`${visibleRecipes.length} công thức hiển thị`} className="mt-5">
        <div className="profession-recipe-grid">
          {visibleRecipes.map((recipe) => {
            const locked = professionRankOrder(currentRank) < professionRankOrder(recipe.requiredRank);
            const stationServices = professionStationServices[recipe.station] ?? [];
            const stationOk = stationServices.length === 0 || stationServices.some((service) => services.includes(service));
            const stationLocation = stationServices.length ? stationLocations.find((location) => stationServices.some((service) => location.services.includes(service))) : null;
            const mastery = masteryByRecipeId.get(recipe.id);
            const facilityGrade = resolveProfessionFacilityGrade(stationOk ? c.currentLocation : stationLocation ?? c.currentLocation, recipe.station);
            const facility = professionFacilityNames[recipe.station]?.[facilityGrade] ?? professionFacilityFor(recipe.station, recipe.requiredRank);
            const chance = calculateCraftSuccessChance({
              professionRank: currentRank,
              recipeRank: recipe.requiredRank,
              masteryExp: mastery?.masteryExp ?? 0,
              masteryLevel: mastery?.masteryLevel,
              facilityGrade
            });
            const nextMastery = nextMasteryThreshold(chance.masteryLevel);
            const StationIcon = stationIconMap[recipe.station] ?? Hammer;
            return (
              <article key={recipe.id} className={`profession-recipe-card ${locked ? "locked" : ""}`}>
                <div className="profession-recipe-head">
                  <ItemVisual template={recipe.outputTemplate} size="card" />
                  <div>
                    <h3>{recipe.outputTemplate.name}</h3>
                    <p>{formatRarity(recipe.outputTemplate.rarity)} Phẩm · {recipe.outputTemplate.description}</p>
                  </div>
                </div>
                <div className="profession-recipe-meta">
                  <span><Timer size={14} /> {recipe.craftMinutes} phút</span>
                  <span><CurrencyAmount amount={recipe.fee} /></span>
                  <span><Star size={14} /> +{recipe.professionExp} EXP</span>
                </div>
                <div className={stationOk ? "profession-facility-box ok" : "profession-facility-box missing"}>
                  <StationIcon size={18} aria-hidden />
                  <div>
                    <span>Cơ sở yêu cầu</span>
                    <b>{facility.name}</b>
                    <small>{facility.gradeLabel} · +{Math.round(professionFacilitySuccessBonusBps[facilityGrade] / 100)}% {chanceWording.bonusLabel} · {stationOk ? "Đã có cơ sở phù hợp" : `Hiện tại: ${c.currentLocation?.name ?? "Vô định"}`}</small>
                  </div>
                  {stationOk ? <CheckCircle2 size={17} aria-hidden /> : <AlertCircle size={17} aria-hidden />}
                </div>
                <div className="craft-chance-box">
                  <div className="craft-chance-head">
                    <span>{chanceWording.title}</span>
                    <b>{chance.percent}%</b>
                    <em>{chanceLabel(chance.finalBps, chanceWording.perfectLabel)}</em>
                  </div>
                  <div className="profession-job-progress" aria-hidden><span style={{ width: `${chance.percent}%` }} /></div>
                  <div className="craft-mastery-line">
                    <span>Độ thành thạo</span>
                    <b>{mastery?.masteryExp ?? 0} / {nextMastery} EXP</b>
                  </div>
                  <details className="craft-chance-detail">
                    <summary>Chi tiết xác suất</summary>
                    <div><span>Trình độ {activeProfession.name}</span><b>+{Math.round(chance.breakdown.rankBonusBps / 100)}%</b></div>
                    <div><span>Vượt cấp nghề</span><b>+{Math.round(chance.breakdown.overRankBonusBps / 100)}%</b></div>
                    <div><span>Thành thạo công thức</span><b>+{Math.round(chance.breakdown.masteryBps / 100)}%</b></div>
                    <div><span>{facility.name}</span><b>+{Math.round(chance.breakdown.facilityBps / 100)}%</b></div>
                    <div><span>Độ khó công thức</span><b>-{Math.round(chance.breakdown.difficultyBps / 100)}%</b></div>
                  </details>
                </div>
                <div className="profession-ingredients">
                  {ingredientRows(recipe.ingredients).map((row) => {
                    const template = typeof row.itemId === "string" ? ingredientById.get(row.itemId) : null;
                    const required = Number(row.quantity ?? row.qty ?? 1);
                    const owned = typeof row.itemId === "string" ? ownedByTemplateId.get(row.itemId) ?? 0 : 0;
                    return (
                      <span key={`${String(row.itemId)}-${String(row.key)}`} className={owned < required ? "missing" : ""}>
                        {template ? <ItemVisual template={template} size="card" /> : null}
                        <b>{template?.name ?? String(row.key ?? "Nguyên liệu")}</b>
                        <em>{owned}/{required}</em>
                      </span>
                    );
                  })}
                </div>
                {locked ? (
                  <button className="btn btn-secondary w-full" disabled><Lock size={16} /> {professionRankLabels[recipe.requiredRank]}</button>
                ) : (
                  <div className="profession-craft-actions">
                    {!stationOk ? (
                      <div className="profession-station-warning">
                        <AlertCircle size={16} aria-hidden />
                        <span>
                          <b>Cần {facility.name}</b>
                          <small>Hiện tại: {c.currentLocation?.name ?? "Vô định"}{stationLocation ? ` · Gợi ý: ${stationLocation.name}` : ""}</small>
                        </span>
                      </div>
                    ) : null}
                    <form action={startCraftAction}>
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <button className="btn btn-primary w-full" disabled={!stationOk || hasActiveCraft}>
                        <Play size={16} /> {!stationOk ? "Cần đúng cơ sở" : hasActiveCraft ? "Đang chế tạo" : "Chế tạo"}
                      </button>
                    </form>
                    {!stationOk && stationLocation ? <a className="profession-station-link" href={`/game/world?location=${stationLocation.key}`}><MapPin size={14} aria-hidden /> Xem {stationLocation.name}</a> : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </FacilityPanel>
    </FacilityPage>
    </GamePageBackground>
  );
}

function ingredientRows(value: unknown): IngredientRow[] {
  return Array.isArray(value) ? value.filter((entry): entry is IngredientRow => Boolean(entry && typeof entry === "object")) : [];
}

function ProfessionRankTrack({ currentOrder, experience }: { currentOrder: number; experience: number }) {
  const currentRank = professionRanks[currentOrder] ?? "APPRENTICE";
  const nextRank = professionRanks[currentOrder + 1] ?? null;
  const nextThreshold = nextRank ? professionRankExpThresholds[currentRank] : null;
  const progress = nextThreshold ? Math.min(100, Math.round((experience / nextThreshold) * 100)) : 100;
  return (
    <div className="profession-rank-compact">
      <div className="profession-rank-flow">
        {professionRanks.map((rank, index) => (
          <span key={rank} className={index <= currentOrder ? "unlocked" : ""}>{professionRankLabels[rank]}</span>
        ))}
      </div>
      <div className="profession-job-progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
      <p>{nextRank ? `${experience.toLocaleString("vi-VN")} / ${nextThreshold?.toLocaleString("vi-VN")} EXP · Mốc tiếp theo: ${professionRankLabels[nextRank]}` : "Đã đạt bậc nghề tối đa."}</p>
    </div>
  );
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

function craftChanceWording(professionKey: string) {
  if (professionKey === "alchemy") return { title: "Xác suất thành đan", bonusLabel: "Thành Đan", perfectLabel: "Chắc chắn thành đan" };
  if (professionKey === "forging") return { title: "Xác suất thành khí", bonusLabel: "Thành Khí", perfectLabel: "Chắc chắn thành khí" };
  if (professionKey === "talisman") return { title: "Xác suất thành phù", bonusLabel: "Thành Phù", perfectLabel: "Chắc chắn thành phù" };
  if (professionKey === "formation") return { title: "Xác suất thành trận", bonusLabel: "Thành Trận", perfectLabel: "Chắc chắn thành trận" };
  return { title: "Xác suất chế tạo", bonusLabel: "Thành Công", perfectLabel: "Chắc chắn thành công" };
}

function chanceLabel(bps: number, perfectLabel: string) {
  const percent = Math.round(bps / 100);
  if (percent >= 100) return perfectLabel;
  if (percent >= 90) return "Rất cao";
  if (percent >= 70) return "Ổn định";
  if (percent >= 50) return "Có thể thử";
  if (percent >= 25) return "Khó";
  return "Rất khó";
}
