import { prisma } from "@ttg/db";
import { CharacterVisual } from "@/components/CharacterVisual";
import { getLeaderboardRankVisual } from "@ttg/game";

export default async function LeaderboardPage() {
  const rows = await prisma.character.findMany({ take: 50, orderBy: [{ cultivation: "desc" }, { reputation: "desc" }], include: { realmStage: { include: { realm: true } }, sect: true } });
  return (
    <div className="leaderboard-page p-5 lg:p-8">
      <header className="border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Thiên Đạo Bảng</p>
        <h1 className="mt-1 text-3xl font-black">Xếp Hạng</h1>
        <p className="muted mt-2">Bảng tu vi hiện tại của tu giới. Top 1-5 được Thiên Đạo ghi dấu riêng.</p>
      </header>
      <section className="panel leaderboard-panel mt-6 overflow-x-auto rounded-lg p-4">
        <table className="leaderboard-table w-full min-w-[760px] text-sm">
          <thead className="text-left text-gold">
            <tr><th>#</th><th>Nhân vật</th><th>Cảnh giới</th><th>Tu vi</th><th>Tông môn</th><th>Danh vọng</th></tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const rank = i + 1;
              const visual = getLeaderboardRankVisual(rank);
              return (
                <tr key={c.id} className={`leaderboard-row ${visual.className}`}>
                  <td className="leaderboard-rank-cell"><span className={`leaderboard-rank-mark ${visual.rankClass}`}>#{rank}</span></td>
                  <td>
                    <div className="leaderboard-character-cell">
                      <CharacterVisual character={c} mode="avatar" size={visual.avatarSize} className={`leaderboard-avatar ${visual.avatarClass}`} priority={rank <= 5} />
                      <div className="leaderboard-character-name">
                        <b className={visual.nameClass}>{c.name}</b>
                        {visual.label ? <span>{visual.label}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td><span className="leaderboard-realm">{c.realmStage.realm.name} {c.realmStage.name}</span></td>
                  <td className="leaderboard-cultivation">{c.cultivation.toLocaleString("vi-VN")}</td>
                  <td>{c.sect?.name ?? "Tán tu"}</td>
                  <td>{c.reputation.toLocaleString("vi-VN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
