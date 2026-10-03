import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActionAlert } from "@/components/ActionAlert";
import { cancelTrainingAction, claimTrainingAction, startTrainingAction } from "@/lib/forms";
import { currentEnergy, trainingDurationConfigs, trainingDurationOptions, trainingTypeConfigs, trainingTypes, calculateTrainingGain, trainingStatCap, type TrainingDurationKey, type TrainingTypeKey } from "@ttg/game";
import { FacilityActionCard, FacilityPage, FacilityPanel, FacilityTierStrip, FacilityTutorial } from "@/components/FacilityPage";
import { GamePageBackground } from "@/components/GamePageBackground";
import { CheckCircle2, Dumbbell, Lock, Timer, XCircle } from "lucide-react";

export default async function TrainingPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  const now = new Date();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      currentLocation: true,
      realmStage: { include: { realm: true } },
      trainingJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" }, take: 1 }
    }
  });
  const energy = currentEnergy(c, now);
  const statCap = trainingStatCap(c.realmStage.realm.order, c.realmStage.order);
  const active = c.trainingJobs[0] ?? null;

  return (
    <GamePageBackground type="training">
    <FacilityPage eyebrow="Rèn luyện" title="Luyện Võ Trường" description="Rèn thân thể và chiến lực theo phiên thời gian, tách biệt với tu vi cảnh giới.">
      <ActionAlert message={params?.error} />
      <FacilityTutorial title="Hướng dẫn Rèn Luyện">
        Chọn nhánh rèn và thời lượng. Backend sẽ trừ Thể Lực ngay khi bắt đầu, phiên vẫn chạy khi offline, và chỉ tăng chỉ số khi bạn nhận kết quả.
      </FacilityTutorial>

      {active ? <ActiveTrainingPanel active={active} now={now} /> : null}

      <section className="mt-4 grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <FacilityPanel title="Cơ sở hiện tại" subtitle={c.currentLocation?.name ?? "Vô định"}>
          <div className="info-table">
            <div><span>HP</span><b>{c.hp}/{c.maxHp}</b></div>
            <div><span>Chân nguyên</span><b>{c.qi}/{c.maxQi}</b></div>
            <div><span>Thể lực</span><b>{energy}/{c.energyMax}</b></div>
            <div><span>Giới hạn rèn</span><b>{statCap}</b></div>
          </div>
        </FacilityPanel>

        <FacilityPanel title="Bài rèn" subtitle={active ? "Đang có phiên rèn luyện" : "Chọn một nhánh để bắt đầu"}>
          <div className="facility-action-grid">
            {trainingTypes.map((trainingType) => (
              <TrainingCard
                key={trainingType}
                trainingType={trainingType}
                character={c}
                energy={energy}
                statCap={statCap}
                locked={Boolean(active)}
              />
            ))}
          </div>
        </FacilityPanel>
      </section>

      <FacilityPanel title="Tầng tiến triển" subtitle="Lộ trình rèn luyện" className="mt-5">
        <FacilityTierStrip>
          {["Mở võ trường", "Tập theo thời gian", "Nhận tăng trưởng", "Mở bài rèn nâng cao"].map((label, index) => (
            <div key={label} className={index <= 2 ? "facility-tier unlocked" : "facility-tier locked"}>
              {index <= 2 ? <CheckCircle2 size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
              <span>{label}</span>
              <small>{index <= 2 ? "Đã mở" : "Chưa mở"}</small>
            </div>
          ))}
        </FacilityTierStrip>
      </FacilityPanel>
    </FacilityPage>
    </GamePageBackground>
  );
}

function ActiveTrainingPanel({ active, now }: { active: { id: string; trainingType: string; durationKey: string; endsAt: Date; energyCost: number; finalGain: number }; now: Date }) {
  const typeConfig = trainingTypeConfigs[active.trainingType as TrainingTypeKey] ?? trainingTypeConfigs.BODY;
  const ready = active.endsAt <= now;
  return (
    <FacilityPanel title={`Đang rèn: ${typeConfig.label}`} subtitle={ready ? "Đã hoàn thành" : `Còn ${formatRemaining(active.endsAt, now)}`} className="mt-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="info-table">
          <div><span>Thể Lực đã tiêu hao</span><b>{active.energyCost}</b></div>
          <div><span>Kết quả dự kiến</span><b>+{active.finalGain} {typeConfig.label}</b></div>
          <div><span>Hoàn thành lúc</span><b>{active.endsAt.toLocaleString("vi-VN")}</b></div>
        </div>
        <div className="grid content-start gap-2">
          {ready ? (
            <form action={claimTrainingAction}>
              <input type="hidden" name="id" value={active.id} />
              <button className="btn w-full"><CheckCircle2 size={16} aria-hidden /> Nhận kết quả</button>
            </form>
          ) : (
            <button className="btn w-full" disabled><Timer size={16} aria-hidden /> Chưa hoàn thành</button>
          )}
          <form action={cancelTrainingAction}>
            <input type="hidden" name="id" value={active.id} />
            <button className="btn btn-secondary w-full"><XCircle size={16} aria-hidden /> Dừng sớm</button>
          </form>
        </div>
      </div>
    </FacilityPanel>
  );
}

function TrainingCard({ trainingType, character, energy, statCap, locked }: { trainingType: TrainingTypeKey; character: { body: number; attack: number; defense: number; speed: number; spirit: number }; energy: number; statCap: number; locked: boolean }) {
  const typeConfig = trainingTypeConfigs[trainingType];
  const stat = character[typeConfig.statKey];
  return (
    <FacilityActionCard title={typeConfig.label} meta={`Hiện tại ${stat}/${statCap}`} description={typeConfig.description}>
      <div className="training-duration-grid">
        {trainingDurationOptions.map((duration) => {
          const config = trainingDurationConfigs[duration];
          const gain = calculateTrainingGain({ stat, statCap, baseGain: config.baseGain, modifierBps: typeConfig.modifierBps });
          const disabled = locked || energy < config.energyCost || gain <= 0;
          return (
            <form key={duration} action={startTrainingAction} className="training-duration-card">
              <input type="hidden" name="trainingType" value={trainingType} />
              <input type="hidden" name="duration" value={duration} />
              <b>{config.label}</b>
              <span>{config.energyCost} Thể Lực</span>
              <small>Dự kiến +{gain} {typeConfig.label}</small>
              <button className="btn btn-secondary w-full" disabled={disabled}><Dumbbell size={16} aria-hidden /> Bắt đầu</button>
            </form>
          );
        })}
      </div>
    </FacilityActionCard>
  );
}

function formatRemaining(endsAt: Date, now: Date) {
  const seconds = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
