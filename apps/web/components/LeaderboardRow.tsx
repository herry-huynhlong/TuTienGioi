import type { CSSProperties, ReactNode } from "react";
import { getLeaderboardCinematic } from "@/lib/leaderboardCinematics";
import { CinematicBackground } from "./CinematicBackground";

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
      <CinematicSceneLayer theme={props.theme} rank={props.rank} />
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

function CinematicSceneLayer({ theme, rank }: { theme: LeaderboardTheme; rank: number }) {
  const cinematic = getLeaderboardCinematic(rank, theme);

  return (
    <div className="lb-cinematic-layer" data-theme={cinematic.theme} aria-hidden>
      <CinematicBackground
        webm={cinematic.webm}
        mp4={cinematic.mp4}
        poster={cinematic.poster}
        label={cinematic.label}
        missingLabel={`MISSING: ${cinematic.webm}`}
        preload={cinematic.preload}
      />
      <span className="lb-cinematic-fallback" />
      <span className="lb-cinematic-depth lb-cinematic-depth-a" />
      <span className="lb-cinematic-depth lb-cinematic-depth-b" />
    </div>
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
