import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { FacilityActionCard, FacilityPage, FacilityPanel, FacilityTierStrip, FacilityTutorial } from "@/components/FacilityPage";
import { formatRarity } from "@/lib/format";
import { BookOpen, Lock, Sparkles } from "lucide-react";

export default async function TechniquesPage() {
  const user = await getUser();
  const [c, techniques] = await Promise.all([
    prisma.character.findUniqueOrThrow({
      where: { userId: user!.id },
      include: { techniques: { include: { technique: true }, orderBy: [{ equipped: "desc" }, { level: "desc" }] } }
    }),
    prisma.technique.findMany({ orderBy: [{ realmOrder: "asc" }, { name: "asc" }] })
  ]);
  const learnedIds = new Set(c.techniques.map((entry) => entry.techniqueId));
  const equipped = c.techniques.find((entry) => entry.equipped);

  return (
    <FacilityPage eyebrow="Công pháp" title="Tàng Kinh Các" description="Quản lý công pháp đã học, trạng thái vận chuyển và tầng mở khóa. Học mới, nâng cấp và đổi công pháp sẽ chỉ mở khi có server action tương ứng.">
      <FacilityTutorial title="Hướng dẫn Công Pháp">
        Công pháp là nền tăng trưởng dài hạn của nhân vật. Trang này chỉ hiển thị dữ liệu đã có trong database; các hành động chưa nối backend được khóa để tránh sai lệch sức mạnh.
      </FacilityTutorial>

      <section className="mt-4 grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <FacilityPanel title="Công pháp đang vận chuyển" subtitle={equipped ? `Cấp ${equipped.level}` : "Chưa chọn"}>
          {equipped ? (
            <div className="facility-current">
              <BookOpen size={24} aria-hidden />
              <div>
                <h2>{equipped.technique.name}</h2>
                <p>{equipped.technique.type} · {formatRarity(equipped.technique.rarity)} · hiệu suất {Math.round(equipped.technique.cultivationModifierBps / 100)}%</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <b>Chưa vận chuyển công pháp.</b>
              <p>Nhân vật có thể chưa học công pháp, hoặc workflow trang bị công pháp chưa được mở.</p>
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button className="btn btn-secondary" disabled><Lock size={16} aria-hidden /> Đổi công pháp</button>
            <button className="btn btn-secondary" disabled><Lock size={16} aria-hidden /> Nâng cấp</button>
          </div>
        </FacilityPanel>

        <FacilityPanel title="Công pháp đã học" subtitle={`${c.techniques.length} bộ`}>
          {c.techniques.length > 0 ? (
            <div className="facility-action-grid">
              {c.techniques.map((entry) => (
                <FacilityActionCard key={entry.id} title={entry.technique.name} meta={`${entry.technique.type} · Cấp ${entry.level}`} description={entry.technique.description}>
                  <span className="badge">{entry.equipped ? "Đang vận chuyển" : "Đã học"}</span>
                </FacilityActionCard>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>Chưa học công pháp.</b>
              <p>Công pháp sẽ xuất hiện tại đây sau khi hệ thống học công pháp được nối dữ liệu.</p>
            </div>
          )}
        </FacilityPanel>
      </section>

      <FacilityPanel title="Kho công pháp" subtitle="Dữ liệu seed hiện có" className="mt-5">
        <FacilityTierStrip>
          {techniques.map((technique) => {
            const learned = learnedIds.has(technique.id);
            return (
              <div key={technique.id} className={learned ? "facility-tier unlocked" : "facility-tier locked"}>
                {learned ? <Sparkles size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
                <span>{technique.name}</span>
                <small>{learned ? "Đã học" : "Chưa mở"}</small>
              </div>
            );
          })}
        </FacilityTierStrip>
      </FacilityPanel>
    </FacilityPage>
  );
}
