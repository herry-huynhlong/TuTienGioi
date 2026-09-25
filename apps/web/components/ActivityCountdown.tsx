"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function ActivityCountdown({ startedAt, endsAt }: { startedAt: string; endsAt: string }) {
  const router = useRouter();
  const startMs = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const endMs = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, endMs - now);
  const total = Math.max(1, endMs - startMs);
  const progress = Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0) {
      const id = window.setTimeout(() => router.refresh(), 500);
      return () => window.clearTimeout(id);
    }
  }, [remaining, router]);

  return (
    <div className="live-countdown">
      <div className="resource-track h-3">
        <div className="resource-fill resource-cultivation" style={{ width: `${progress}%` }} />
      </div>
      <div className="live-countdown-meta">
        <span>{progress}%</span>
        <b>{formatRemaining(remaining)}</b>
      </div>
    </div>
  );
}

function formatRemaining(ms: number) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
