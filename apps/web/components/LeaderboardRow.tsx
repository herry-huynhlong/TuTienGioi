import type { CSSProperties, ReactNode } from "react";

export type LeaderboardTheme = "gold" | "frost" | "ember" | "jade" | "violet" | "normal";

export type LeaderboardRowProps = {
  rank: number;
  avatar: ReactNode;
  name: string;
  realm: string;
  cultivation: string;
  sect: string;
  fame: string;
  title?: string | null;
  theme: LeaderboardTheme;
};

export function LeaderboardRow({ rank, avatar, name, realm, cultivation, sect, fame, title, theme }: LeaderboardRowProps) {
  return (
    <article className="leaderboard-row" data-theme={theme} data-top-rank={rank <= 10 ? "true" : "false"}>
      <div className="leaderboard-row-environment" aria-hidden>
        <span className="leaderboard-cloud leaderboard-cloud-a" />
        <span className="leaderboard-cloud leaderboard-cloud-b" />
        <span className="leaderboard-light-sweep" />
      </div>

      <DecorativeCreature theme={theme} />
      <Particles theme={theme} />

      <div className="leaderboard-row-rank" aria-label={`Hạng ${rank}`}>
        <div className="leaderboard-rank-frame">
          <span className="leaderboard-rank-halo" aria-hidden />
          <strong>{rank}</strong>
        </div>
      </div>

      <div className="leaderboard-row-character">
        <div className="leaderboard-avatar-shell">{avatar}</div>
        <div className="leaderboard-name-block">
          <strong>{name}</strong>
          <span>{title || "Tán tu"}</span>
        </div>
      </div>

      <div className="leaderboard-row-realm">
        <span className="leaderboard-field-label">Cảnh giới</span>
        <strong>{realm}</strong>
      </div>

      <div className="leaderboard-row-cultivation">
        <span className="leaderboard-cultivation-orb" aria-hidden />
        <strong>{cultivation}</strong>
      </div>

      <div className="leaderboard-row-sect">
        <SectGlyph />
        <strong>{sect}</strong>
      </div>

      <div className="leaderboard-row-fame">
        <span aria-hidden />
        <strong>{fame}</strong>
      </div>
    </article>
  );
}

function DecorativeCreature({ theme }: { theme: LeaderboardTheme }) {
  const isPhoenix = theme === "ember";

  return (
    <svg className="leaderboard-creature" viewBox="0 0 420 150" aria-hidden>
      {isPhoenix ? (
        <>
          <path d="M48 92c54-37 94-9 129-55 31 41 74 39 122 17-25 29-42 53-44 76-24-28-53-39-85-27-39 14-75 3-122-11Z" />
          <path d="M166 40c-12-15-19-26-21-35 31 9 54 27 69 55" />
          <path d="M213 62c32-13 61-16 87-9-27 9-49 24-66 45" />
        </>
      ) : (
        <>
          <path d="M34 94c49-72 108 30 172-37 45-46 113-17 153 24-54-19-88 3-126 33-62 49-113-43-199-20Z" />
          <path d="M281 51c28 5 55 19 75 43-34-14-61-8-91 17 12-22 16-42 16-60Z" />
          <path d="M93 66c20-11 37-10 51 3M174 79c21 10 42 8 63-9M258 38l25-26 2 35" />
        </>
      )}
    </svg>
  );
}

function Particles({ theme }: { theme: LeaderboardTheme }) {
  const particles = Array.from({ length: theme === "normal" ? 4 : 9 }, (_, index) => index);

  return (
    <div className="leaderboard-particles" aria-hidden>
      {particles.map((particle) => (
        <span key={particle} style={{ "--particle-index": particle } as CSSProperties} />
      ))}
    </div>
  );
}

function SectGlyph() {
  return (
    <svg className="leaderboard-sect-glyph" viewBox="0 0 60 46" aria-hidden>
      <path d="M8 37h44v5H8z" />
      <path d="M14 24h32v13H14z" />
      <path d="M30 6 6 23h48L30 6Z" />
      <path d="M20 37V25m20 12V25" />
    </svg>
  );
}
