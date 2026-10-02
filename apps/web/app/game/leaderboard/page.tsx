import { prisma } from "@ttg/db";
import { CharacterVisual } from "@/components/CharacterVisual";
import { LeaderboardCompactCard, LeaderboardHeroCard, type LeaderboardEntry, type LeaderboardKind, type LeaderboardTheme } from "@/components/LeaderboardRow";
import { getRankVisualForLeaderboardRank } from "@/lib/leaderboardWings";
import { calculateWealthScore, getSectRank, isLeaderboardType, sectBackgroundAssetPath, type LeaderboardType } from "@ttg/game";

const tabs: Array<{ type: LeaderboardType; label: string; summary: string }> = [
  { type: "cultivation", label: "Tu Vi", summary: "Xếp theo cảnh giới, tầng và tu vi tích lũy thật." },
  { type: "wealth", label: "Tài Bảo", summary: "Xếp theo tài sản tiền tệ server tính từ Linh Thạch và Tiên Ngọc." },
  { type: "sect", label: "Tông Môn", summary: "Xếp theo uy danh tông môn, phẩm cấp và quy mô thành viên." }
];

export default async function LeaderboardPage({ searchParams }: { searchParams?: Promise<{ type?: string }> }) {
  const params = await searchParams;
  const activeType = isLeaderboardType(params?.type) ? params.type : "cultivation";
  const activeTab = tabs.find((tab) => tab.type === activeType)!;
  const entries = activeType === "sect" ? await sectLeaderboardEntries() : await characterLeaderboardEntries(activeType);
  const featured = entries.slice(0, 3);
  const compact = entries.slice(3);

  return (
    <div className="leaderboard-page lb-page p-5 lg:p-8">
      <header className="leaderboard-hero lb-page-hero">
        <p className="text-xs font-bold uppercase text-jade">Thiên Đạo Bảng</p>
        <h1>Xếp Hạng</h1>
        <p>{activeTab.summary} Top 1-3 được Thiên Đạo ghi dấu riêng.</p>
      </header>

      <nav className="lb-category-tabs" aria-label="Loại bảng xếp hạng">
        {tabs.map((tab) => (
          <a key={tab.type} href={`/game/leaderboard?type=${tab.type}`} className={tab.type === activeType ? "active" : ""}>
            {tab.label}
          </a>
        ))}
      </nav>

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

async function characterLeaderboardEntries(type: Exclude<LeaderboardType, "sect">): Promise<LeaderboardEntry[]> {
  const rows = await prisma.character.findMany({
    take: type === "wealth" ? 120 : 30,
    orderBy: type === "wealth"
      ? [{ linhThach: "desc" }, { tienNgoc: "desc" }, { reputation: "desc" }]
      : [{ realmStage: { realm: { order: "desc" } } }, { realmStage: { order: "desc" } }, { cultivation: "desc" }, { reputation: "desc" }],
    include: { realmStage: { include: { realm: true } }, sect: true }
  });
  const sorted = type === "wealth"
    ? [...rows].sort((a, b) => {
      const wealthA = calculateWealthScore(a);
      const wealthB = calculateWealthScore(b);
      if (wealthA === wealthB) return Number(b.reputation - a.reputation);
      return wealthA > wealthB ? -1 : 1;
    }).slice(0, 30)
    : rows;

  return sorted.map((character, index): LeaderboardEntry => {
    const rank = index + 1;
    const realmName = `${character.realmStage.realm.name} ${character.realmStage.name}`;
    const sect = character.sect ? ({ type: "sect", name: character.sect.name, iconKey: character.sect.iconKey } as const) : ({ type: "independent" } as const);
    const theme = getLeaderboardTheme(rank);
    const avatarSize = getLeaderboardAvatarSize(rank);
    const score = calculateWealthScore(character);

    return {
      rank,
      kind: type,
      avatar: <CharacterVisual character={character} mode="avatar" size={avatarSize} className="lb-character-visual" priority={rank <= 3} />,
      name: character.name,
      title: character.title,
      realm: realmName,
      cultivation: character.cultivation.toLocaleString("vi-VN"),
      metricLabel: type === "wealth" ? "Tài bảo" : undefined,
      metricValue: type === "wealth" ? `${score.toLocaleString("vi-VN")} Linh Thạch` : undefined,
      sect,
      fame: character.reputation.toLocaleString("vi-VN"),
      theme,
      rankVisual: getRankVisualForLeaderboardRank(rank)
    };
  });
}

async function sectLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const rows = await prisma.sect.findMany({
    take: 30,
    include: {
      members: { include: { character: true }, orderBy: [{ role: "asc" }, { contribution: "desc" }] }
    },
    orderBy: [{ reputation: "desc" }, { rank: "asc" }, { createdAt: "asc" }]
  });
  return rows.map((sect, index): LeaderboardEntry => {
    const rank = index + 1;
    const leader = sect.members.find((member) => member.characterId === sect.leaderId)?.character ?? sect.members[0]?.character;
    return {
      rank,
      kind: "sect",
      avatar: null,
      name: sect.name,
      title: sect.tag,
      realm: getSectRank(sect.rank).label,
      cultivation: "",
      sect: { type: "sect", name: sect.name, iconKey: sect.iconKey },
      fame: sect.reputation.toLocaleString("vi-VN"),
      memberCount: sect.members.length,
      leaderName: leader?.name ?? "Chưa rõ",
      background: sectBackgroundAssetPath(sect.backgroundKey),
      theme: getLeaderboardTheme(rank),
      rankVisual: null
    };
  });
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
