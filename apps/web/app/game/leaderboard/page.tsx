import { prisma } from "@ttg/db";
import { CharacterVisual } from "@/components/CharacterVisual";
import { getLeaderboardRankVisual } from "@ttg/game";

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
            const visual = getLeaderboardRankVisual(rank);
            const tier = typeof visual.tier === "number" ? visual.tier : "normal";
            const realmName = `${character.realmStage.realm.name} ${character.realmStage.name}`;
            const sectName = character.sect?.name ?? "Tán tu";

            return (
              <article key={character.id} className={`leaderboard-entry ${visual.className}`} data-rank-tier={tier}>
                <div className="leaderboard-dragon" aria-hidden />
                <div className="leaderboard-sparks" aria-hidden />
                <RankEmblem rank={rank} rankClass={visual.rankClass} />

                <div className="leaderboard-person">
                  <div className={`leaderboard-avatar-frame ${visual.avatarClass}`}>
                    <CharacterVisual character={character} mode="avatar" size={visual.avatarSize} className="leaderboard-avatar" priority={rank <= 5} />
                  </div>
                  <div className="leaderboard-character-name">
                    <b className={visual.nameClass}>{character.name}</b>
                    <span>{character.title}</span>
                  </div>
                </div>

                <RealmVisual realmName={realmName} />
                <CultivationOrb value={character.cultivation} />
                <SectVisual name={sectName} />
                <ReputationBadge value={character.reputation} />
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RankEmblem({ rank, rankClass }: { rank: number; rankClass: string }) {
  return (
    <div className="leaderboard-rank-cell" aria-label={`Hạng ${rank}`}>
      <div className={`leaderboard-rank-emblem ${rankClass}`}>
        <span className="rank-wing rank-wing-left" aria-hidden />
        <span className="rank-wing rank-wing-right" aria-hidden />
        <span className="rank-ring" aria-hidden />
        <b>{rank}</b>
      </div>
    </div>
  );
}

function RealmVisual({ realmName }: { realmName: string }) {
  return (
    <div className="leaderboard-realm-block">
      <svg className="realm-dragon-mark" viewBox="0 0 120 46" aria-hidden>
        <path d="M12 28c18-24 38 3 54-17 12-15 31-5 39 5-16-3-20 8-35 15-22 10-35-11-58-3Z" />
        <path d="M83 14c9 1 17 5 23 12-11-4-21-2-30 5 4-7 6-12 7-17Z" />
      </svg>
      <span>{realmName}</span>
    </div>
  );
}

function CultivationOrb({ value }: { value: bigint }) {
  return (
    <div className="leaderboard-orb" aria-label={`Tu vi ${value.toLocaleString("vi-VN")}`}>
      <span className="orb-ring" aria-hidden />
      <strong>{value.toLocaleString("vi-VN")}</strong>
    </div>
  );
}

function SectVisual({ name }: { name: string }) {
  return (
    <div className="leaderboard-sect">
      <svg viewBox="0 0 60 46" aria-hidden>
        <path d="M8 37h44v5H8z" />
        <path d="M14 24h32v13H14z" />
        <path d="M30 6 6 23h48L30 6Z" />
        <path d="M20 37V25m20 12V25" />
      </svg>
      <span>{name}</span>
    </div>
  );
}

function ReputationBadge({ value }: { value: number }) {
  return (
    <div className="leaderboard-reputation" aria-label={`Danh vọng ${value.toLocaleString("vi-VN")}`}>
      <span aria-hidden />
      <strong>{value.toLocaleString("vi-VN")}</strong>
    </div>
  );
}
