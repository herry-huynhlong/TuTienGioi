"use client";

import { useEffect, useMemo, useState } from "react";

const realMinutesPerGameDay = 15;
const realTimeToGameTimeMultiplier = 1440 / realMinutesPerGameDay;
const gameEpochMs = Date.parse("2026-01-01T00:00:00.000Z");
const startYear = 13;
const monthDays = 30;
const yearMonths = 12;
const earthlyHours = ["Giờ Tý", "Giờ Sửu", "Giờ Sửu", "Giờ Dần", "Giờ Dần", "Giờ Mão", "Giờ Mão", "Giờ Thìn", "Giờ Thìn", "Giờ Tỵ", "Giờ Tỵ", "Giờ Ngọ", "Giờ Ngọ", "Giờ Mùi", "Giờ Mùi", "Giờ Thân", "Giờ Thân", "Giờ Dậu", "Giờ Dậu", "Giờ Tuất", "Giờ Tuất", "Giờ Hợi", "Giờ Hợi", "Giờ Tý"];

function displayGameTime(date: Date) {
  const elapsedGameMs = Math.max(0, date.getTime() - gameEpochMs) * realTimeToGameTimeMultiplier;
  const totalHours = Math.floor(elapsedGameMs / 3_600_000);
  const totalDays = Math.floor(totalHours / 24);
  const hour = totalHours % 24;
  return {
    eraName: "Thiên Hoang",
    year: startYear + Math.floor(totalDays / (monthDays * yearMonths)),
    month: Math.floor(totalDays / monthDays) % yearMonths + 1,
    day: totalDays % monthDays + 1,
    hourName: earthlyHours[Math.max(0, Math.min(23, hour))]!
  };
}

export function WorldClock({ serverNow }: { serverNow: string }) {
  const serverMs = useMemo(() => new Date(serverNow).getTime(), [serverNow]);
  const [now, setNow] = useState(() => new Date(serverMs));

  useEffect(() => {
    const realStart = Date.now();
    const timer = window.setInterval(() => {
      setNow(new Date(serverMs + Date.now() - realStart));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [serverMs]);

  const gameTime = displayGameTime(now);
  return (
    <section className="world-clock" aria-label="Vạn Giới Lịch">
      <p>VẠN GIỚI LỊCH</p>
      <b>{gameTime.eraName} · Năm {gameTime.year}</b>
      <span>Ngày {gameTime.day} tháng {gameTime.month} · {gameTime.hourName}</span>
    </section>
  );
}
