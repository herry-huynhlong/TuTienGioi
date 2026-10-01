import { prisma } from "@ttg/db";
import { CharacterVisual } from "@/components/CharacterVisual";
import { LeaderboardCompactCard, LeaderboardHeroCard, type LeaderboardEntry, type LeaderboardTheme } from "@/components/LeaderboardRow";

export default async function LeaderboardPage() {
  const rows = await prisma.character.findMany({
    take: 50,
    orderBy: [{ cultivation: "desc" }, { reputation: "desc" }],
    include: { realmStage: { include: { realm: true } }, sect: true }
  });
  const entries = rows.map((character, index): LeaderboardEntry => {
    const rank = index + 1;
    const realmName = `${character.realmStage.realm.name} ${character.realmStage.name}`;
    const sect = character.sect ? ({ type: "sect", name: character.sect.name } as const) : ({ type: "independent" } as const);
    const theme = getLeaderboardTheme(rank);
    const avatarSize = getLeaderboardAvatarSize(rank);

    return {
      rank,
      avatar: <CharacterVisual character={character} mode="avatar" size={avatarSize} className="lb-character-visual" priority={rank <= 3} />,
      name: character.name,
      title: character.title,
      realm: realmName,
      cultivation: character.cultivation.toLocaleString("vi-VN"),
      sect,
      fame: character.reputation.toLocaleString("vi-VN"),
      theme
    };
  });
  const featured = entries.slice(0, 3);
  const compact = entries.slice(3);

  return (
    <div className="leaderboard-page lb-page p-5 lg:p-8">
      <header className="leaderboard-hero lb-page-hero">
        <p className="text-xs font-bold uppercase text-jade">Thiên Đạo Bảng</p>
        <h1>Xếp Hạng</h1>
        <p>Bảng tu vi hiện tại của tu giới. Top 1-5 được Thiên Đạo ghi dấu riêng.</p>
      </header>

      <section className="lb-featured-ranks" aria-label="Top 3 Thiên Đạo Bảng">
        {featured.map((entry) => (
          <LeaderboardHeroCard key={entry.rank} {...entry} />
        ))}
      </section>

      {compact.length > 0 ? (
        <section className="lb-compact-ranks" aria-label="Các hạng tiếp theo">
          <div className="lb-compact-title">
            <span>Thiên Đạo Lưu Danh</span>
            <strong>Hạng 4 trở đi</strong>
          </div>
          <div className="lb-compact-list">
            {compact.map((entry) => (
              <LeaderboardCompactCard key={entry.rank} {...entry} />
            ))}
          </div>
        </section>
      ) : null}
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
  if (rank === 1) return 110;
  if (rank === 2) return 96;
  if (rank === 3) return 92;
  if (rank <= 10) return 58;
  return 46;
}
