import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { prisma } from "@ttg/db";
import { getFeatureUnlockState } from "@ttg/game";
import { getRealtimeCounts } from "@/lib/realtime";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/");
  const character = await prisma.character.findUnique({
    where: { userId: user.id },
    include: {
      realmStage: { include: { realm: true } },
      currentLocation: { include: { zone: { include: { region: true } } } },
      location: true,
      sect: true,
      notifications: { where: { readAt: null }, take: 99 }
    }
  });
  const [featureUnlocks, realtimeCounts] = character
    ? await Promise.all([getFeatureUnlockState(prisma, character.id), getRealtimeCounts(character.id)])
    : [null, { unreadMessages: 0, pendingFriendRequests: 0, unreadNotifications: 0 }];
  return (
    <RealtimeProvider initialCounts={realtimeCounts}>
      <Shell user={{ username: user.username, role: user.role }} character={character} featureUnlocks={featureUnlocks}>{children}</Shell>
    </RealtimeProvider>
  );
}
