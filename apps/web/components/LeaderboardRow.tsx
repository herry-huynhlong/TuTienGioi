import type { CSSProperties, ReactNode } from "react";

export type LeaderboardTheme = "gold" | "frost" | "ember" | "jade" | "violet" | "normal";

export type LeaderboardEntry = {
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

export function LeaderboardHeroCard(props: LeaderboardEntry) {
  return (
    <article className="lb-hero-card" data-theme={props.theme} data-rank={props.rank}>
      <BackgroundLayer />
      <EnvironmentLayer />
      <CreatureLayer theme={props.theme} />
      <ParticleLayer theme={props.theme} count={props.rank === 1 ? 18 : 14} />
      <BorderFXLayer />

      <div className="lb-hero-character-layer">
        <RankMedallion rank={props.rank} hero />
        <CharacterPortrait avatar={props.avatar} hero />
        <div className="lb-hero-nameplate">
          <strong>{props.name}</strong>
          <span>{props.title || "Tán tu"}</span>
        </div>
      </div>

      <div className="lb-hero-content-layer">
        <div className="lb-hero-realm">
          <span>Cảnh giới</span>
          <strong>{props.realm}</strong>
        </div>
      </div>

      <div className="lb-hero-stat-layer">
        <CultivationStat value={props.cultivation} hero />
        <SectCrest name={props.sect} hero />
        <div className="lb-fame-seal">
          <span>Danh vọng</span>
          <strong>{props.fame}</strong>
        </div>
      </div>

      <ForegroundLayer />
    </article>
  );
}

export function LeaderboardCompactCard(props: LeaderboardEntry) {
  return (
    <article className="lb-compact-card" data-theme={props.theme}>
      <BackgroundLayer compact />
      <ParticleLayer theme={props.theme} count={5} compact />

      <div className="lb-compact-main">
        <RankMedallion rank={props.rank} />
        <CharacterPortrait avatar={props.avatar} />
        <div className="lb-compact-identity">
          <strong>{props.name}</strong>
          <span>{props.title || "Tán tu"}</span>
        </div>
      </div>

      <div className="lb-compact-meta">
        <div>
          <span>Cảnh giới</span>
          <strong>{props.realm}</strong>
        </div>
        <div>
          <span>Tu vi</span>
          <strong>{props.cultivation}</strong>
        </div>
        <div>
          <span>Tông môn</span>
          <strong>{props.sect}</strong>
        </div>
        <div>
          <span>Danh vọng</span>
          <strong>{props.fame}</strong>
        </div>
      </div>
    </article>
  );
}

function BackgroundLayer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "lb-background-layer lb-background-layer-compact" : "lb-background-layer"} aria-hidden>
      <span className="lb-bg-vignette" />
      <span className="lb-bg-depth lb-bg-depth-a" />
      <span className="lb-bg-depth lb-bg-depth-b" />
    </div>
  );
}

function EnvironmentLayer() {
  return (
    <div className="lb-environment-layer" aria-hidden>
      <span className="lb-cloud lb-cloud-a" />
      <span className="lb-cloud lb-cloud-b" />
      <span className="lb-aura-river lb-aura-river-a" />
      <span className="lb-aura-river lb-aura-river-b" />
      <span className="lb-aura-river lb-aura-river-c" />
      <span className="lb-sanctum" />
    </div>
  );
}

function CreatureLayer({ theme }: { theme: LeaderboardTheme }) {
  return (
    <svg className="lb-creature-layer" data-creature={theme === "ember" ? "phoenix" : theme === "frost" ? "ice-dragon" : "dragon"} viewBox="0 0 720 230" aria-hidden>
      {theme === "ember" ? (
        <>
          <path d="M80 143c101-71 176-30 243-101 41 43 95 61 168 35-35 34-63 65-77 101-45-40-93-53-150-30-65 26-117 12-184-5Z" />
          <path d="M233 105C165 62 109 67 48 98c62-69 146-70 251-25" />
          <path d="M380 83c93-51 173-49 254-4-82 2-141 34-185 98" />
          <path d="M306 51c-27-35-42-60-45-83 62 22 111 61 150 126" />
          <path d="M214 156c66 47 146 45 243 2" />
        </>
      ) : (
        <>
          <path d="M54 145c84-116 182 43 292-66 83-82 212-36 288 43-96-32-160 7-230 64-111 90-202-75-350-41Z" />
          <path d="M484 72c60 8 114 36 157 86-70-32-126-17-182 33 23-43 29-80 25-119Z" />
          <path d="M147 100c41-25 78-24 109 3M306 127c45 18 87 10 128-24M452 61l53-56 8 74" />
          <path d="M370 90c37-42 81-55 131-37" />
          <path d="M248 74c-20-18-48-25-83-21" />
        </>
      )}
    </svg>
  );
}

function ParticleLayer({ theme, count, compact = false }: { theme: LeaderboardTheme; count: number; compact?: boolean }) {
  return (
    <div className={compact ? "lb-particle-layer lb-particle-layer-compact" : "lb-particle-layer"} data-theme={theme} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} style={{ "--particle-index": index } as CSSProperties} />
      ))}
    </div>
  );
}

function ForegroundLayer() {
  return (
    <div className="lb-foreground-layer" aria-hidden>
      <span className="lb-light-sweep" />
    </div>
  );
}

function BorderFXLayer() {
  return (
    <div className="lb-border-fx-layer" aria-hidden>
      <span className="lb-corner lb-corner-tl" />
      <span className="lb-corner lb-corner-tr" />
      <span className="lb-corner lb-corner-bl" />
      <span className="lb-corner lb-corner-br" />
    </div>
  );
}

function CharacterPortrait({ avatar, hero = false }: { avatar: ReactNode; hero?: boolean }) {
  return (
    <div className={hero ? "lb-character-portrait lb-character-portrait-hero" : "lb-character-portrait"}>
      <span className="lb-portrait-halo" aria-hidden />
      <div className="lb-portrait-frame">{avatar}</div>
    </div>
  );
}

function RankMedallion({ rank, hero = false }: { rank: number; hero?: boolean }) {
  return (
    <div className={hero ? "lb-rank-medallion lb-rank-medallion-hero" : "lb-rank-medallion"} aria-label={`Hạng ${rank}`}>
      <span className="lb-rank-wings" aria-hidden />
      <span className="lb-rank-ring" aria-hidden />
      <strong>{rank}</strong>
    </div>
  );
}

function CultivationStat({ value, hero = false }: { value: string; hero?: boolean }) {
  return (
    <div className={hero ? "lb-cultivation-stat lb-cultivation-stat-hero" : "lb-cultivation-stat"}>
      <span>Tu vi</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectCrest({ name, hero = false }: { name: string; hero?: boolean }) {
  return (
    <div className={hero ? "lb-sect-crest lb-sect-crest-hero" : "lb-sect-crest"}>
      <svg viewBox="0 0 72 72" aria-hidden>
        <path d="M36 6 57 18v22c0 14-8 23-21 28C23 63 15 54 15 40V18L36 6Z" />
        <path d="M25 31h22M29 24h14M24 45h24M30 31v14M42 31v14M36 18v31" />
      </svg>
      <strong>{name}</strong>
    </div>
  );
}
