import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { prisma } from "@ttg/db";
import { getFeatureUnlockState } from "@ttg/game";

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
      notifications: { where: { readAt: null }, take: 1 }
    }
  });
  const featureUnlocks = character ? await getFeatureUnlockState(prisma, character.id) : null;
  return <Shell user={{ username: user.username, role: user.role }} character={character} featureUnlocks={featureUnlocks}>{children}</Shell>;
}
