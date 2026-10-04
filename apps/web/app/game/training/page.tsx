import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActionAlert } from "@/components/ActionAlert";
import { cancelTrainingAction, claimTrainingAction, startTrainingAction } from "@/lib/forms";
import { currentEnergy, trainingDurationConfigs, trainingDurationOptions, trainingTypeConfigs, trainingTypes, calculateTrainingGain, trainingStatCap, type TrainingDurationKey, type TrainingTypeKey } from "@ttg/game";
import { FacilityPage, FacilityPanel, FacilityTierStrip, FacilityTutorial } from "@/components/FacilityPage";
import { GamePageBackground } from "@/components/GamePageBackground";
import { CheckCircle2, Clock, Droplets, Dumbbell, Eye, Gauge, Heart, HeartPulse, Info, Lock, MapPin, Play, Shield, Swords, Timer, TrendingUp, Wind, XCircle, Zap, type LucideIcon } from "lucide-react";

const trainingIconMap: Record<TrainingTypeKey, LucideIcon> = {
  BODY: HeartPulse,
  ATTACK: Swords,
  DEFENSE: Shield,
  SPEED: Wind,
  SPIRIT: Eye
};

const trainingHintMap: Record<TrainingTypeKey, string> = {
  BODY: "Tăng vĩnh viễn Thể Phách",
  ATTACK: "Tăng vĩnh viễn Công Kích",
  DEFENSE: "Tăng vĩnh viễn Phòng Ngự",
  SPEED: "Tăng vĩnh viễn Thân Pháp",
  SPIRIT: "Tăng vĩnh viễn Thần Thức"
};

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
    <FacilityPage
      eyebrow={<span className="training-eyebrow"><Dumbbell size={15} aria-hidden /> Rèn luyện</span>}
      title="Luyện Võ Trường"
      description="Rèn luyện thân thể và chiến lực, từng bước củng cố căn cơ."
      action={
        <div className="training-location-badge">
          <MapPin size={15} aria-hidden />
          <span>{c.currentLocation?.name ?? "Vô định"}</span>
        </div>
      }
    >
      <ActionAlert message={params?.error} />

      <FacilityTutorial title="Hướng dẫn">
        <div className="training-guide">
          <Info size={18} aria-hidden />
          <p>
            Chọn phương pháp và thời gian rèn luyện. Thể Lực sẽ tiêu hao khi bắt đầu, quá trình vẫn tiếp tục khi rời game, và chỉ số chỉ tăng sau khi bạn nhận kết quả.
          </p>
        </div>
      </FacilityTutorial>

      <section className="mt-4 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <FacilityPanel title="Cơ sở hiện tại" subtitle={c.currentLocation?.name ?? "Vô định"}>
          <div className="training-resource-grid">
            <TrainingResourceCard icon={Heart} label="HP" value={`${c.hp}/${c.maxHp}`} />
            <TrainingResourceCard icon={Droplets} label="Chân Nguyên" value={`${c.qi}/${c.maxQi}`} />
            <TrainingResourceCard icon={Zap} label="Thể Lực" value={`${energy}/${c.energyMax}`} accent />
            <TrainingResourceCard icon={Gauge} label="Giới Hạn Rèn" value={statCap.toString()} />
          </div>
        </FacilityPanel>

        <FacilityPanel title="Chỉ số rèn luyện" subtitle={`Giới hạn hiện tại ${statCap}`}>
          <div className="training-stat-grid">
            {trainingTypes.map((trainingType) => {
              const typeConfig = trainingTypeConfigs[trainingType];
              const stat = c[typeConfig.statKey];
              return <TrainingStatCard key={trainingType} trainingType={trainingType} value={stat} cap={statCap} />;
            })}
          </div>
        </FacilityPanel>
      </section>

      {active ? <ActiveTrainingPanel active={active} now={now} /> : null}

      <FacilityPanel title="Chọn nhánh rèn" subtitle={active ? "Đang có phiên rèn luyện" : "Chỉ số nhận được sẽ cộng trực tiếp vào nhân vật"} className="mt-5">
        <div className="training-branch-grid">
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
  const Icon = trainingIconMap[active.trainingType as TrainingTypeKey] ?? Dumbbell;
  const duration = trainingDurationConfigs[active.durationKey as TrainingDurationKey];
  const startedAtMs = duration ? active.endsAt.getTime() - duration.durationSeconds * 1000 : now.getTime();
  const elapsed = Math.max(0, now.getTime() - startedAtMs);
  const total = duration ? duration.durationSeconds * 1000 : Math.max(1, active.endsAt.getTime() - startedAtMs);
  const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  const ready = active.endsAt <= now;
  return (
    <FacilityPanel title={ready ? "Hoàn thành" : "Đang rèn luyện"} subtitle={ready ? "Có thể nhận kết quả" : `Còn ${formatRemaining(active.endsAt, now)}`} className="mt-5 training-active-panel">
      <div className="training-active-layout">
        <div className="training-active-main">
          <div className="training-active-icon"><Icon size={28} aria-hidden /></div>
          <div>
            <p className="training-active-kicker">{ready ? "Rèn luyện hoàn tất" : "Đang vận chuyển khí huyết"}</p>
            <h2>{typeConfig.label}</h2>
            <p>Không tăng chỉ số cho đến khi nhận kết quả.</p>
          </div>
        </div>

        <div className="training-active-detail">
          <div className="training-active-progress">
            <span style={{ width: `${ready ? 100 : progress}%` }} />
          </div>
          <div className="training-active-stats">
            <div><Zap size={15} aria-hidden /><span>Thể Lực đã tiêu hao</span><b>{active.energyCost}</b></div>
            <div><TrendingUp size={15} aria-hidden /><span>Kết quả dự kiến</span><b>+{active.finalGain} {typeConfig.label}</b></div>
            <div><Clock size={15} aria-hidden /><span>Hoàn thành lúc</span><b>{active.endsAt.toLocaleString("vi-VN")}</b></div>
          </div>
        </div>

        <div className="training-active-actions">
          {ready ? (
            <form action={claimTrainingAction}>
              <input type="hidden" name="id" value={active.id} />
              <button className="btn w-full"><CheckCircle2 size={16} aria-hidden /> Nhận Kết Quả</button>
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
  const Icon = trainingIconMap[trainingType];
  const progress = statCap > 0 ? Math.min(100, Math.round((stat / statCap) * 100)) : 0;
  const atCap = stat >= statCap;
  return (
    <div className={`training-branch-card training-branch-${trainingType.toLowerCase()}`}>
      <div className="training-branch-head">
        <div className="training-branch-icon"><Icon size={22} aria-hidden /></div>
        <div>
          <b>{typeConfig.label}</b>
          <small>{trainingHintMap[trainingType]}</small>
        </div>
      </div>
      <p>{typeConfig.description}</p>
      <div className="training-branch-cap">
        <div>
          <span>Chỉ số hiện tại</span>
          <b>{stat}/{statCap}</b>
        </div>
        <div className="training-stat-progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
        {atCap ? <small className="training-warning">Đã đạt giới hạn. Đột phá cảnh giới để nâng giới hạn rèn luyện.</small> : null}
      </div>
      <div className="training-duration-grid">
        {trainingDurationOptions.map((duration) => {
          const config = trainingDurationConfigs[duration];
          const gain = calculateTrainingGain({ stat, statCap, baseGain: config.baseGain, modifierBps: typeConfig.modifierBps });
          const disabled = locked || energy < config.energyCost || gain <= 0;
          const disabledReason = locked ? "Đang có phiên rèn khác" : energy < config.energyCost ? "Không đủ Thể Lực" : gain <= 0 ? "Đã đạt giới hạn" : null;
          return (
            <form key={duration} action={startTrainingAction} className="training-duration-card">
              <input type="hidden" name="trainingType" value={trainingType} />
              <input type="hidden" name="duration" value={duration} />
              <div className="training-duration-meta">
                <b><Clock size={14} aria-hidden /> {config.label}</b>
                <span><Zap size={14} aria-hidden /> -{config.energyCost} Thể Lực</span>
                <small><TrendingUp size={14} aria-hidden /> +{gain} dự kiến</small>
              </div>
              {disabledReason ? <em>{disabledReason}</em> : null}
              <button className="btn btn-secondary w-full" disabled={disabled}><Play size={15} aria-hidden /> Bắt đầu rèn</button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

function TrainingResourceCard({ icon: Icon, label, value, accent = false }: { icon: LucideIcon; label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "training-resource-card accent" : "training-resource-card"}>
      <Icon size={18} aria-hidden />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function TrainingStatCard({ trainingType, value, cap }: { trainingType: TrainingTypeKey; value: number; cap: number }) {
  const typeConfig = trainingTypeConfigs[trainingType];
  const Icon = trainingIconMap[trainingType];
  const progress = cap > 0 ? Math.min(100, Math.round((value / cap) * 100)) : 0;
  return (
    <div className="training-stat-card">
      <div className="training-stat-head">
        <Icon size={18} aria-hidden />
        <span>{typeConfig.label}</span>
      </div>
      <b>{value} / {cap}</b>
      <div className="training-stat-progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}

function formatRemaining(endsAt: Date, now: Date) {
  const seconds = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
