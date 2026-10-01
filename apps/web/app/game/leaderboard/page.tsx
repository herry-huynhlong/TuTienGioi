import { prisma } from "@ttg/db";
import { CharacterVisual } from "@/components/CharacterVisual";
import { LeaderboardRow, type LeaderboardTheme } from "@/components/LeaderboardRow";

export default async function LeaderboardPage() {
  const rows = await prisma.character.findMany({
    take: 50,
    orderBy: [{ cultivation: "desc" }, { reputation: "desc" }],
    include: { realmStage: { include: { realm: true } }, sect: true }
  });

  return (
    <div className="leaderboard-page p-5 lg:p-8">
      <header className="leaderboard-hero">
        <p className="text-xs font-bold uppercase text-jade">Thiên Đạo Bảng</p>
        <h1>Xếp Hạng</h1>
        <p>Bảng tu vi hiện tại của tu giới. Top 1-5 được Thiên Đạo ghi dấu riêng.</p>
      </header>

      <section className="leaderboard-board" aria-label="Thiên Đạo Bảng">
        <div className="leaderboard-head" aria-hidden>
          <span>#</span>
          <span>Nhân vật</span>
          <span>Cảnh giới</span>
          <span>Tu vi</span>
          <span>Tông môn</span>
          <span>Danh vọng</span>
        </div>

        <div className="leaderboard-list">
          {rows.map((character, index) => {
            const rank = index + 1;
            const realmName = `${character.realmStage.realm.name} ${character.realmStage.name}`;
            const sectName = character.sect?.name ?? "Tán tu";
            const theme = getLeaderboardTheme(rank);
            const avatarSize = getLeaderboardAvatarSize(rank);

            return (
              <LeaderboardRow
                key={character.id}
                rank={rank}
                avatar={<CharacterVisual character={character} mode="avatar" size={avatarSize} className="leaderboard-avatar" priority={rank <= 3} />}
                name={character.name}
                title={character.title}
                realm={realmName}
                cultivation={character.cultivation.toLocaleString("vi-VN")}
                sect={sectName}
                fame={character.reputation.toLocaleString("vi-VN")}
                theme={theme}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function getLeaderboardTheme(rank: number): LeaderboardTheme {
  if (rank === 1) return "gold";
  if (rank === 2) return "frost";
  if (rank === 3) return "ember";
  if (rank <= 5) return "jade";
  if (rank <= 10) return "violet";
  return "normal";
}

function getLeaderboardAvatarSize(rank: number) {
  if (rank === 1) return 64;
  if (rank === 2) return 58;
  if (rank === 3) return 54;
  if (rank <= 10) return 48;
  return 38;
}
