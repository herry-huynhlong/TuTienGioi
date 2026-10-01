"use client";

import { useEffect, useRef, useState } from "react";

type CinematicBackgroundProps = {
  webm: string;
  mp4: string;
  poster: string;
  label: string;
  missingLabel: string;
  preload?: "auto" | "metadata" | "none";
};

const isDevelopment = process.env.NODE_ENV !== "production";

export function CinematicBackground({ webm, mp4, poster, label, missingLabel, preload = "metadata" }: CinematicBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inViewportRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canRenderVideo, setCanRenderVideo] = useState(false);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncReducedMotion = () => {
      reducedMotionRef.current = reducedMotionQuery.matches;
      setReducedMotion(reducedMotionQuery.matches);
      setCanRenderVideo(!reducedMotionQuery.matches);
      if (reducedMotionQuery.matches) videoRef.current?.pause();
    };

    syncReducedMotion();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    return () => reducedMotionQuery.removeEventListener("change", syncReducedMotion);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    const playIfAllowed = () => {
      if (!inViewportRef.current || document.hidden || reducedMotionRef.current) return;
      void video.play().catch(() => undefined);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewportRef.current = Boolean(entry?.isIntersecting);
        if (inViewportRef.current) {
          playIfAllowed();
        } else {
          video.pause();
        }
      },
      { threshold: 0.15 }
    );

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        playIfAllowed();
      }
    };

    observer.observe(video);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!failed || !isDevelopment) return;
    console.warn(`[Leaderboard cinematic missing] ${missingLabel}`);
  }, [failed, missingLabel]);

  return (
    <>
      {canRenderVideo ? (
        <video
          ref={videoRef}
          className="lb-cinematic-video"
          autoPlay
          muted
          loop
          playsInline
          preload={preload}
          poster={poster}
          aria-label={label}
          data-state={failed ? "fallback" : "video"}
          onCanPlay={() => setFailed(false)}
          onError={() => setFailed(true)}
        >
          <source src={webm} type="video/webm" onError={() => setFailed(true)} />
          <source src={mp4} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      ) : (
        <img className="lb-cinematic-poster" src={poster} alt="" loading="lazy" decoding="async" data-reduced-motion={reducedMotion ? "true" : "false"} />
      )}
      {failed && isDevelopment ? <div className="lb-cinematic-missing">{missingLabel}</div> : null}
    </>
  );
}
