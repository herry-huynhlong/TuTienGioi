import { ActionAlert } from "@/components/ActionAlert";
import { RealtimeChat } from "@/components/RealtimeChat";
import { getUser } from "@/lib/auth";
import { formatItemCategory, formatRarity } from "@/lib/format";
import { getRealtimeSnapshot } from "@/lib/realtime";
import { prisma } from "@ttg/db";
import { getItemEconomy, markConversationRead } from "@ttg/game";
import { redirect } from "next/navigation";

type SearchParams = { with?: string; error?: string };

export default async function ChatPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user?.character) redirect("/");

  const characterId = user.character.id;
  const selectedPeerId = params?.with ?? "";

  const [me, snapshot, friendships, blockedRows] = await Promise.all([
    prisma.character.findUniqueOrThrow({ where: { id: characterId }, select: { linhThach: true } }),
    getRealtimeSnapshot(characterId, selectedPeerId || undefined),
    prisma.friendship.findMany({ where: { OR: [{ memberAId: characterId }, { memberBId: characterId }] } }),
    prisma.blockedPlayer.findMany({ where: { OR: [{ blockerId: characterId }, { blockedId: characterId }] } })
  ]);

  const selectedConversation = selectedPeerId ? snapshot.conversations.find((row) => row.peerId === selectedPeerId) : null;
  if (selectedConversation) await markConversationRead(prisma, characterId, selectedConversation.id);

  const friendIds = new Set(friendships.map((row) => row.memberAId === characterId ? row.memberBId : row.memberAId));
  const blockedIds = new Set(blockedRows.map((row) => row.blockerId === characterId ? row.blockedId : row.blockerId));
  const isFriend = selectedPeerId ? friendIds.has(selectedPeerId) : false;
  const isBlocked = selectedPeerId ? blockedIds.has(selectedPeerId) : false;
  const canTransfer = Boolean(selectedPeerId && isFriend && !isBlocked);

  const transferableItems = canTransfer
    ? await prisma.itemInstance.findMany({
        where: {
          ownerId: characterId,
          quantity: { gt: 0 },
          bound: false,
          equippedSlot: null,
          template: { tradeable: true, category: { not: "QUEST" } },
          listings: { none: { status: "ACTIVE" } }
        },
        include: { template: true },
        orderBy: { createdAt: "desc" },
        take: 24
      })
    : [];

  return (
    <div className="chat-page p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Xã Hội</p>
        <h1 className="mt-1 text-3xl font-black">Tin Nhắn</h1>
        <p className="muted mt-2">Trao đổi riêng, giữ lịch sử hội thoại và gửi tài sản cho bằng hữu.</p>
      </header>

      <ActionAlert message={params?.error} />

      <RealtimeChat
        characterId={characterId}
        selectedPeerId={selectedPeerId}
        initialSnapshot={{
          conversations: snapshot.conversations,
          selectedPeer: snapshot.selectedPeer,
          messages: snapshot.messages
        }}
        canTransfer={canTransfer}
        isBlocked={isBlocked}
        linhThach={me.linhThach.toString()}
        transferableItems={transferableItems.map((item) => {
          const economy = getItemEconomy(item.template);
          return {
            id: item.id,
            name: item.template.name,
            rarity: `${formatRarity(item.template.rarity)} Phẩm`,
            category: economy.subType || formatItemCategory(item.template.category),
            quantity: item.quantity,
            stackable: item.template.stackable,
            priceAmount: economy.systemBasePrice.toString()
          };
        })}
      />
    </div>
  );
}
