import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FacilityPage, FacilityPanel, FacilityTutorial } from "@/components/FacilityPage";
import { GamePageBackground } from "@/components/GamePageBackground";
import { formatRarity, formatService } from "@/lib/format";
import { claimCraftAction, startCraftAction } from "@/lib/forms";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { ItemVisual } from "@/components/ItemCard";
import { economyFeatureUnlockReasons, hasReachedLuyenKhi1, professionRankExpThresholds, professionRankLabels, professionRankOrder, professionRanks, professionStationLabels, professionStationServices } from "@ttg/game";
import { CheckCircle2, Lock, Play, Timer } from "lucide-react";

type IngredientRow = { itemId?: unknown; key?: unknown; quantity?: unknown; qty?: unknown };

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
  const ingredientIds = [...new Set(visibleRecipes.flatMap((recipe) => ingredientRows(recipe.ingredients).map((row) => String(row.itemId ?? "")).filter(Boolean)))];
  const ingredientTemplates = ingredientIds.length ? await prisma.itemTemplate.findMany({ where: { id: { in: ingredientIds } } }) : [];
  const ingredientById = new Map(ingredientTemplates.map((item) => [item.id, item]));
  const ownedByTemplateId = new Map<string, number>();
  for (const item of c.items) ownedByTemplateId.set(item.templateId, (ownedByTemplateId.get(item.templateId) ?? 0) + item.quantity);
  const services = c.currentLocation?.services ?? [];
  const hasActiveCraft = c.craftJobs.length > 0;

  return (
    <GamePageBackground type="profession">
    <FacilityPage eyebrow="Nghề nghiệp" title="Công Xưởng Tu Tiên" description="Cây nghề nghiệp dùng recipe, nguyên liệu, phí và thời gian thật. Công thức bậc hiện tại mở, bậc kế tiếp hiển thị khóa để định hướng tiến triển.">
      {params?.error ? <div className="action-alert error">{params.error}</div> : null}
      <FacilityTutorial title="Hướng dẫn Nghề Nghiệp">
        Chọn nghề, kiểm tra bậc nghề và đứng đúng cơ sở. Khi bắt đầu chế tạo, nguyên liệu và Linh Thạch bị trừ ngay; khi hoàn thành hãy nhận thành phẩm vào Ba Lô để lấy EXP nghề.
      </FacilityTutorial>

      <section className="profession-tabs">
        {professions.map((profession) => {
          const entry = c.professions.find((row) => row.professionId === profession.id);
          const rank = entry?.rank ?? "APPRENTICE";
          return (
            <a key={profession.id} href={`/game/profession?profession=${profession.key}`} className={profession.id === activeProfession.id ? "active" : ""}>
              <b>{profession.name}</b>
              <span>{professionRankLabels[rank]} · {entry?.experience ?? 0} EXP</span>
            </a>
          );
        })}
      </section>

      <section className="mt-4 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <FacilityPanel title="Cây bậc nghề" subtitle={activeProfession.name}>
          <div className="profession-rank-track">
            {professionRanks.map((rank, index) => {
              const unlocked = index <= currentOrder;
              const threshold = professionRankExpThresholds[rank];
              return (
                <div key={rank} className={`profession-rank-node ${unlocked ? "unlocked" : "locked"}`}>
                  {unlocked ? <CheckCircle2 size={18} /> : <Lock size={18} />}
                  <b>{professionRankLabels[rank]}</b>
                  <span>{threshold ? `Mốc ${threshold.toLocaleString("vi-VN")} EXP` : "Tối đa"}</span>
                </div>
              );
            })}
          </div>
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
                return (
                  <div key={job.id} className="activity-row">
                    <span>
                      <b>{job.recipe.name}</b>
                      <small>{job.recipe.profession.name} · tạo {job.recipe.outputTemplate.name} · {ready ? "đã hoàn thành" : `xong ${job.endsAt.toLocaleString("vi-VN")}`}</small>
                    </span>
                    <form action={claimCraftAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button className="btn btn-secondary min-h-0 px-3 py-1 text-xs" disabled={!ready}>{ready ? "Nhận" : "Đang luyện"}</button>
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
                  <span>+{recipe.professionExp} EXP</span>
                  <span>{professionStationLabels[recipe.station] ?? recipe.station}</span>
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
                  <form action={startCraftAction}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button className="btn btn-primary w-full" disabled={!stationOk || hasActiveCraft}>
                      <Play size={16} /> {!stationOk ? "Sai cơ sở" : hasActiveCraft ? "Đang chế tạo" : "Chế tạo"}
                    </button>
                  </form>
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
