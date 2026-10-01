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
        <span className="leaderboard-vfx-frame" />
        <span className="leaderboard-left-bloom" />
        <span className="leaderboard-right-sanctum" />
        <span className="leaderboard-aura-trail leaderboard-aura-trail-a" />
        <span className="leaderboard-aura-trail leaderboard-aura-trail-b" />
        <span className="leaderboard-aura-trail leaderboard-aura-trail-c" />
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
          <path d="M33 100c58-43 100-19 139-63 24 24 55 35 97 23-20 19-36 37-44 58-26-24-54-30-86-17-37 14-67 8-106-1Z" />
          <path d="M128 77c-37-24-70-22-103-4 33-39 81-40 139-15" />
          <path d="M204 62c55-30 100-28 146-3-45 1-77 18-101 55" />
          <path d="M170 38c-15-20-23-34-25-47 34 12 62 34 84 71" />
        </>
      ) : (
        <>
          <path d="M28 96c47-66 101 22 162-38 48-47 121-21 164 23-54-18-90 3-129 35-62 51-112-41-197-20Z" />
          <path d="M270 49c34 4 64 20 88 48-39-18-70-10-101 18 12-24 16-45 13-66Z" />
          <path d="M84 68c23-14 43-13 60 2M169 82c25 10 48 6 70-13M251 40l29-31 4 40" />
          <path d="M207 58c20-23 44-30 72-20" />
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
