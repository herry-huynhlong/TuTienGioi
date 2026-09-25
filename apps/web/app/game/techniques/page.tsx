import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { FacilityActionCard, FacilityPage, FacilityPanel, FacilityTutorial } from "@/components/FacilityPage";
import { formatRarity } from "@/lib/format";
import { BookOpen } from "lucide-react";

export default async function TechniquesPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: { techniques: { include: { technique: true }, orderBy: [{ equipped: "desc" }, { level: "desc" }] } }
  });
  const equipped = c.techniques.find((entry) => entry.equipped);

  return (
    <FacilityPage eyebrow="Công pháp" title="Công Pháp" description="Quản lý các công pháp nhân vật đã lĩnh ngộ, tầng hiện tại và độ thuần thục khi vận hành chân nguyên.">
      <FacilityTutorial title="Hướng dẫn Công Pháp">
        Công pháp quyết định cách tu sĩ vận hành chân nguyên và phát huy chiến lực. Những bí tịch chưa lĩnh ngộ sẽ nằm trong Túi Đồ, không xuất hiện trong danh sách này.
      </FacilityTutorial>

      <section className="mt-4 grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <FacilityPanel title="Công pháp đang vận chuyển" subtitle={equipped ? `Cấp ${equipped.level}` : "Chưa chọn"}>
          {equipped ? (
            <>
              <div className="facility-current">
                <BookOpen size={24} aria-hidden />
                <div>
                  <h2>{equipped.technique.name}</h2>
                  <p>{equipped.technique.type} · {formatRarity(equipped.technique.rarity)} · hiệu suất {Math.round(equipped.technique.cultivationModifierBps / 100)}%</p>
                </div>
              </div>
              <MasteryBar experience={equipped.experience} />
            </>
          ) : (
            <div className="empty-state">
              <b>Chưa vận chuyển công pháp.</b>
              <p>Hãy lĩnh ngộ công pháp trước khi chọn vận chuyển.</p>
            </div>
          )}
        </FacilityPanel>

        <FacilityPanel title="Công pháp đã học" subtitle={`${c.techniques.length} bộ`}>
          {c.techniques.length > 0 ? (
            <div className="facility-action-grid">
              {c.techniques.map((entry) => (
                <FacilityActionCard key={entry.id} title={entry.technique.name} meta={`${entry.technique.type} · Cấp ${entry.level}`} description={entry.technique.description}>
                  <span className="badge">{entry.equipped ? "Đang vận chuyển" : "Đã học"}</span>
                  <MasteryBar experience={entry.experience} compact />
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
    </FacilityPage>
  );
}

function MasteryBar({ experience, compact = false }: { experience: number; compact?: boolean }) {
  const required = 100;
  const current = Math.max(0, Math.min(required, experience % (required + 1)));
  const percent = Math.round((current / required) * 100);
  return (
    <div className={compact ? "mastery-box compact" : "mastery-box"}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="muted">Độ thuần thục</span>
        <b className="text-gold">{current}/{required} · {masteryLabel(percent)}</b>
      </div>
      <div className="resource-track mt-2 h-3">
        <div className="resource-fill resource-cultivation" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function masteryLabel(percent: number) {
  if (percent >= 100) return "Viên Mãn";
  if (percent >= 75) return "Tinh Thông";
  if (percent >= 50) return "Đại Thành";
  if (percent >= 25) return "Tiểu Thành";
  return "Nhập Môn";
}
