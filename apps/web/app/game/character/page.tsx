import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";

export default async function CharacterPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: { realmStage: { include: { realm: true } }, spiritualRoot: true, talents: { include: { talent: true } }, techniques: { include: { technique: true } }, items: { include: { template: true } } }
  });
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-3xl font-black">Nhân Vật</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">{c.name}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {Object.entries({ "Danh hiệu": c.title, "Linh căn": c.spiritualRoot.name, "HP": `${c.hp}/${c.maxHp}`, "Chân nguyên": `${c.qi}/${c.maxQi}`, "Công kích": c.attack, "Phòng ngự": c.defense, "Tốc độ": c.speed, "Khí vận": c.luck }).map(([k, v]) => <div key={k}><dt className="muted">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>)}
          </dl>
        </section>
        <section className="panel rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">Thiên phú & Công pháp</h2>
          <div className="mt-4 space-y-3">
            {c.talents.map((t) => <p key={t.talentId} className="muted">{t.talent.name} · {t.talent.description}</p>)}
            {c.techniques.map((t) => <p key={t.id} className="muted">{t.technique.name} cấp {t.level}</p>)}
          </div>
        </section>
      </div>
      <section className="panel mt-6 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gold">Túi đồ & Trang bị</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">{c.items.map((item) => <div key={item.id} className="rounded-md bg-white/5 p-3">{item.template.name} x{item.quantity}</div>)}</div>
      </section>
    </div>
  );
}
