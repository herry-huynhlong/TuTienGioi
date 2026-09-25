import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { FacilityActionCard, FacilityPage, FacilityPanel, FacilityTierStrip, FacilityTutorial } from "@/components/FacilityPage";
import { Lock } from "lucide-react";

const trainingStats = [
  { key: "body", label: "Thể phách", description: "Nền chịu đòn và sức bền thân thể." },
  { key: "attack", label: "Công kích", description: "Sát thương khi giao chiến với yêu thú hoặc người chơi." },
  { key: "defense", label: "Phòng ngự", description: "Khả năng giảm sát thương nhận vào." },
  { key: "speed", label: "Thân pháp", description: "Ảnh hưởng tốc độ ra tay và né tránh." },
  { key: "spirit", label: "Thần thức", description: "Nền tảng cảm nhận, khống chế và một số công pháp." }
] as const;

export default async function TrainingPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({ where: { userId: user!.id }, include: { currentLocation: true } });
  const values = {
    body: c.body,
    attack: c.attack,
    defense: c.defense,
    speed: c.speed,
    spirit: c.spirit
  };

  return (
    <FacilityPage eyebrow="Rèn luyện" title="Luyện Võ Trường" description="Theo dõi nền tảng thân thể và các bài rèn chiến lực của tu sĩ.">
      <FacilityTutorial title="Hướng dẫn Rèn Luyện">
        Các bài rèn giúp củng cố thân thể, công kích, phòng ngự, thân pháp và thần thức.
      </FacilityTutorial>

      <section className="mt-4 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <FacilityPanel title="Cơ sở hiện tại" subtitle={c.currentLocation?.name ?? "Vô định"}>
          <div className="info-table">
            <div><span>HP</span><b>{c.hp}/{c.maxHp}</b></div>
            <div><span>Chân nguyên</span><b>{c.qi}/{c.maxQi}</b></div>
            <div><span>Thể lực tối đa</span><b>{c.energyMax}</b></div>
            <div><span>Trạng thái</span><b>Đang chuẩn bị</b></div>
          </div>
        </FacilityPanel>

        <FacilityPanel title="Bài rèn" subtitle="Đang chuẩn bị">
          <div className="facility-action-grid">
            {trainingStats.map((stat) => (
              <FacilityActionCard key={stat.key} title={stat.label} meta={`Hiện tại ${values[stat.key]}`} description={stat.description}>
                <button className="btn btn-secondary w-full" disabled><Lock size={16} aria-hidden /> Chưa thể rèn</button>
              </FacilityActionCard>
            ))}
          </div>
        </FacilityPanel>
      </section>

      <FacilityPanel title="Tầng tiến triển" subtitle="Lộ trình rèn luyện" className="mt-5">
        <FacilityTierStrip>
          {["Mở võ trường", "Tập theo thời gian", "Nhận tăng trưởng", "Mở bài rèn mới"].map((label, index) => (
            <div key={label} className={index === 0 ? "facility-tier unlocked" : "facility-tier locked"}>
              <Lock size={16} aria-hidden />
              <span>{label}</span>
              <small>{index === 0 ? "Đã biết" : "Chưa mở"}</small>
            </div>
          ))}
        </FacilityTierStrip>
      </FacilityPanel>
    </FacilityPage>
  );
}
