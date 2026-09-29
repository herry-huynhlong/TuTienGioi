"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeCounts, RealtimeNotification } from "@/lib/realtime";

type RealtimeState = {
  counts: RealtimeCounts;
  latestNotification: RealtimeNotification | null;
  connected: boolean;
};

const emptyCounts: RealtimeCounts = { unreadMessages: 0, pendingFriendRequests: 0, unreadNotifications: 0 };
const RealtimeContext = createContext<RealtimeState>({ counts: emptyCounts, latestNotification: null, connected: false });

export function RealtimeProvider({ initialCounts, children }: { initialCounts: RealtimeCounts; children: React.ReactNode }) {
  const [state, setState] = useState<RealtimeState>({ counts: initialCounts, latestNotification: null, connected: false });
  const seenNotificationId = useRef<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.addEventListener("open", () => setState((current) => ({ ...current, connected: true })));
    source.addEventListener("error", () => setState((current) => ({ ...current, connected: false })));
    source.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent).data) as { counts: RealtimeCounts; latestNotification: RealtimeNotification | null };
      const isNewNotification = hydrated.current && snapshot.latestNotification && snapshot.latestNotification.id !== seenNotificationId.current;
      if (snapshot.latestNotification) seenNotificationId.current = snapshot.latestNotification.id;
      hydrated.current = true;
      setState((current) => ({
        counts: snapshot.counts,
        latestNotification: isNewNotification ? snapshot.latestNotification : current.latestNotification,
        connected: true
      }));
    });
    return () => source.close();
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <RealtimeToast />
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeBadge({ type }: { type: "messages" | "friends" | "notifications" }) {
  const { counts } = useRealtime();
  const value = type === "messages" ? counts.unreadMessages : type === "friends" ? counts.pendingFriendRequests : counts.unreadNotifications;
  if (value <= 0) return null;
  return <span className="nav-unread-badge">{value > 99 ? "99+" : value}</span>;
}

function RealtimeToast() {
  const { latestNotification } = useRealtime();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!latestNotification) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [latestNotification]);

  if (!latestNotification || !visible) return null;
  return (
    <div className="realtime-toast">
      <b>{latestNotification.title}</b>
      <span>{latestNotification.body}</span>
    </div>
  );
}
