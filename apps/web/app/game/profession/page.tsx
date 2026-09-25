import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { FacilityActionCard, FacilityPage, FacilityPanel, FacilityTierStrip, FacilityTutorial } from "@/components/FacilityPage";
import { formatService } from "@/lib/format";
import { Hammer, Lock } from "lucide-react";

export default async function ProfessionPage() {
  const user = await getUser();
  const [c, professions] = await Promise.all([
    prisma.character.findUniqueOrThrow({
      where: { userId: user!.id },
      include: {
        currentLocation: true,
        craftJobs: { where: { status: "ACTIVE" }, include: { recipe: { include: { outputTemplate: true, profession: true } } }, orderBy: { endsAt: "desc" } }
      }
    }),
    prisma.profession.findMany({
      include: { recipes: { include: { outputTemplate: true }, orderBy: { requiredLevel: "asc" } } },
      orderBy: { name: "asc" }
    })
  ]);
  const services = c.currentLocation?.services ?? [];
  const craftServices = services.filter((service) => ["forging", "formation", "resource"].includes(service));

  return (
    <FacilityPage eyebrow="Nghề nghiệp" title="Công Xưởng Tu Tiên" description="Theo dõi luyện đan, luyện khí, chế phù, trận pháp và các nghề kinh tế đã có dữ liệu. Chế tạo chỉ mở khi backend xử lý nguyên liệu, phí, thời gian và nhận thành phẩm hoàn chỉnh.">
      <FacilityTutorial title="Hướng dẫn Nghề Nghiệp">
        Nghề nghiệp dùng công thức, nguyên liệu, phí và thời gian. Schema hiện đã có Profession, Recipe và CraftJob; service tạo/nhận craft job chưa có, nên trang chỉ hiển thị dữ liệu thật và khóa nút thao tác.
      </FacilityTutorial>

      <section className="mt-4 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <FacilityPanel title="Cơ sở hiện tại" subtitle={c.currentLocation?.name ?? "Vô định"}>
          <div className="facility-current">
            <Hammer size={24} aria-hidden />
            <div>
              <h2>{c.currentLocation?.name ?? "Chưa rõ địa điểm"}</h2>
              <p>{craftServices.length ? craftServices.map(formatService).join(", ") : "Địa điểm hiện tại chưa mở dịch vụ nghề nghiệp."}</p>
            </div>
          </div>
          <div className="mt-4 info-table">
            <div><span>Linh thạch</span><b>{c.linhThach.toString()}</b></div>
            <div><span>Việc đang chế tạo</span><b>{c.craftJobs.length}</b></div>
            <div><span>Trạng thái action</span><b>Chưa nối service</b></div>
          </div>
        </FacilityPanel>

        <FacilityPanel title="Việc đang chạy" subtitle="CraftJob">
          {c.craftJobs.length > 0 ? (
            <div className="activity-list">
              {c.craftJobs.map((job) => (
                <div key={job.id} className="activity-row">
                  <span>
                    <b>{job.recipe.name}</b>
                    <small>{job.recipe.profession.name} · tạo {job.recipe.outputTemplate.name} · xong {job.endsAt.toLocaleString("vi-VN")}</small>
                  </span>
                  <button className="btn btn-secondary min-h-0 px-3 py-1 text-xs" disabled>Nhận</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>Không có việc chế tạo đang chạy.</b>
              <p>Khi service chế tạo được nối, các job đang luyện đan/luyện khí sẽ xuất hiện ở đây.</p>
            </div>
          )}
        </FacilityPanel>
      </section>

      <FacilityPanel title="Danh sách nghề" subtitle={`${professions.length} nhánh`} className="mt-5">
        <FacilityTierStrip>
          {professions.map((profession) => (
            <div key={profession.id} className="facility-tier locked">
              <Lock size={16} aria-hidden />
              <span>{profession.name}</span>
              <small>{profession.recipes.length ? `${profession.recipes.length} công thức` : "Chưa có công thức"}</small>
            </div>
          ))}
        </FacilityTierStrip>
      </FacilityPanel>

      <FacilityPanel title="Công thức đã có dữ liệu" subtitle="Chưa mở nút chế tạo" className="mt-5">
        <div className="facility-action-grid">
          {professions.flatMap((profession) =>
            profession.recipes.map((recipe) => (
              <FacilityActionCard
                key={recipe.id}
                title={recipe.name}
                meta={`${profession.name} · Cấp ${recipe.requiredLevel} · ${recipe.craftMinutes} phút · ${recipe.fee.toString()} linh thạch`}
                description={`Tạo ${recipe.outputTemplate.name}. Nguyên liệu: ${formatIngredients(recipe.ingredients)}.`}
              >
                <button className="btn btn-secondary w-full" disabled><Lock size={16} aria-hidden /> Chưa mở chế tạo</button>
              </FacilityActionCard>
            ))
          )}
          {professions.every((profession) => profession.recipes.length === 0) ? (
            <div className="empty-state">
              <b>Chưa có công thức.</b>
              <p>Seed hiện tại chưa tạo công thức nghề nghiệp nào.</p>
            </div>
          ) : null}
        </div>
      </FacilityPanel>
    </FacilityPage>
  );
}

function formatIngredients(value: unknown) {
  if (!Array.isArray(value)) return "chưa rõ";
  const labels = value.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as { key?: unknown; qty?: unknown };
    if (typeof item.key !== "string") return null;
    const qty = typeof item.qty === "number" ? item.qty : 1;
    return `${item.key} x${qty}`;
  }).filter(Boolean);
  return labels.length ? labels.join(", ") : "chưa rõ";
}
