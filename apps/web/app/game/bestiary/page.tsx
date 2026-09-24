import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { BookMarked, Swords } from "lucide-react";

export default async function BestiaryPage() {
  const user = await getUser();
  const character = await prisma.character.findUniqueOrThrow({ where: { userId: user!.id }, select: { id: true } });
  const combats = await prisma.combat.findMany({ where: { characterId: character.id }, orderBy: { createdAt: "desc" } });
  const discoveredKeys = [...new Set(combats.map((combat) => combat.monsterKey))];
  const monsters = discoveredKeys.length > 0 ? await prisma.monster.findMany({ where: { key: { in: discoveredKeys } } }) : [];
  const winsByMonster = new Map<string, number>();
  for (const combat of combats) {
    if (combat.winner === "player") winsByMonster.set(combat.monsterKey, (winsByMonster.get(combat.monsterKey) ?? 0) + 1);
  }

  return (
    <div className="p-5 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-jade">Đồ giám</p>
          <h1 className="mt-1 text-3xl font-black">Yêu Thú Đồ Giám</h1>
        </div>
        <BookMarked className="text-gold" size={30} aria-hidden />
      </header>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {monsters.map((monster) => (
          <article key={monster.id} className="dash-panel">
            <div className="dash-panel-title flex items-center gap-2"><Swords size={16} aria-hidden /> {monster.name}</div>
            <div className="grid gap-3 p-4 text-sm">
              <p className="muted">Đã phát hiện tại: {monster.locationKey}</p>
              <div className="info-table">
                <div><span>Cảnh giới</span><b>Bậc {monster.realmOrder}</b></div>
                <div><span>HP</span><b>{monster.hp}</b></div>
                <div><span>Công kích</span><b>{monster.attack}</b></div>
                <div><span>Đã đánh bại</span><b>{winsByMonster.get(monster.key) ?? 0} lần</b></div>
              </div>
            </div>
          </article>
        ))}
        {monsters.length === 0 ? (
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-bold text-gold">Chưa có ghi chép</h2>
            <p className="muted mt-3">Hãy lịch luyện ngoài thành để phát hiện dấu vết yêu thú. Đồ giám chỉ hé lộ những gì nhân vật thật sự từng gặp.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
