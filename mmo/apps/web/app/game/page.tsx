import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { breakthroughAction, claimCultivationAction, cultivateAction } from "@/lib/forms";
import { currentEnergy } from "@ttg/game";

export default async function Dashboard() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: { realmStage: { include: { realm: true } }, spiritualRoot: true, location: true, currentLocation: true, cultivationJobs: { where: { status: "ACTIVE" }, orderBy: { endsAt: "desc" } }, sect: true }
  });
  const news = await prisma.worldNews.findMany({ take: 6, orderBy: { createdAt: "desc" } });
  const next = await prisma.realmStage.findFirst({
    where: { requiredCultivation: { gt: c.realmStage.requiredCultivation } },
    orderBy: { requiredCultivation: "asc" }
  });
  const progress = next ? Number((c.cultivation * 100n) / next.requiredCultivation) : 100;
  return (
    <div className="p-5 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="muted">/@{user!.username}</p>
          <h1 className="text-3xl font-black text-paper">{c.name}</h1>
        </div>
        <div className="text-right text-sm text-paper/75">{c.currentLocation?.name ?? c.location?.name} · {c.sect?.name ?? "Tán tu"}</div>
      </header>
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Cảnh giới" value={`${c.realmStage.realm.name} ${c.realmStage.name}`} />
        <Stat label="Tu vi" value={c.cultivation.toString()} />
        <Stat label="Linh thạch" value={c.linhThach.toString()} />
        <Stat label="Thể lực" value={`${currentEnergy(c)}/${c.energyMax}`} />
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <div className="panel rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">Tu luyện</h2>
          <div className="mt-3 h-3 overflow-hidden rounded bg-white/10"><div className="h-full bg-jade" style={{ width: `${Math.min(100, progress)}%` }} /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            {[10, 30, 60, 240, 480].map((m) => (
              <form key={m} action={cultivateAction}><input type="hidden" name="minutes" value={m} /><button className="btn btn-secondary w-full">{m >= 60 ? `${m / 60}h` : `${m}p`}</button></form>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {c.cultivationJobs.map((job) => (
              <form key={job.id} action={claimCultivationAction} className="flex items-center justify-between rounded-md bg-white/5 p-3">
                <input type="hidden" name="id" value={job.id} />
                <span className="muted">Kết thúc: {job.endsAt.toLocaleString("vi-VN")}</span>
                <button className="btn">Nhận</button>
              </form>
            ))}
          </div>
          <form action={breakthroughAction} className="mt-5"><button className="btn">Đột phá</button></form>
        </div>
        <div className="panel rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">Thiên Đạo Bảng</h2>
          <div className="mt-4 space-y-3">{news.map((n) => <p key={n.id} className="muted">{n.title}</p>)}</div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="panel rounded-lg p-4"><p className="muted text-sm">{label}</p><p className="mt-1 font-bold text-paper">{value}</p></div>;
}
