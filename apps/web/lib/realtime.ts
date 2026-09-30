import { prisma } from "@ttg/db";

export type RealtimeCounts = {
  unreadMessages: number;
  pendingFriendRequests: number;
  unreadNotifications: number;
};

export type RealtimeConversation = {
  id: string;
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  peerAppearanceKey: string | null;
  peerRealm: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
};

export type RealtimeMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
};

export type RealtimeNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export async function getRealtimeCounts(characterId: string): Promise<RealtimeCounts> {
  const [unreadMessages, pendingFriendRequests, unreadNotifications] = await Promise.all([
    prisma.message.count({ where: { receiverId: characterId, readAt: null } }),
    prisma.friendRequest.count({ where: { addresseeId: characterId, status: "PENDING" } }),
    prisma.notification.count({ where: { characterId, readAt: null } })
  ]);
  return { unreadMessages, pendingFriendRequests, unreadNotifications };
}

export async function getRealtimeSnapshot(characterId: string, peerId?: string) {
  const [counts, conversations, unreadCounts, latestNotification] = await Promise.all([
    getRealtimeCounts(characterId),
    prisma.conversation.findMany({
      where: { OR: [{ memberAId: characterId }, { memberBId: characterId }] },
      include: {
        memberA: { include: { realmStage: { include: { realm: true } } } },
        memberB: { include: { realmStage: { include: { realm: true } } } }
      },
      orderBy: { lastMessageAt: "desc" },
      take: 30
    }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { receiverId: characterId, readAt: null },
      _count: { _all: true }
    }),
    prisma.notification.findFirst({ where: { characterId, readAt: null }, orderBy: { createdAt: "desc" } })
  ]);
  const unreadByConversation = new Map(unreadCounts.map((row) => [row.conversationId, row._count._all]));
  const serializedConversations: RealtimeConversation[] = conversations.map((row) => {
    const peer = row.memberAId === characterId ? row.memberB : row.memberA;
    return {
      id: row.id,
      peerId: peer.id,
      peerName: peer.name,
      peerAvatar: peer.avatar,
      peerAppearanceKey: peer.appearanceKey,
      peerRealm: `${peer.realmStage.realm.name} ${peer.realmStage.name}`,
      lastMessage: row.lastMessage,
      lastMessageAt: row.lastMessageAt.toISOString(),
      unread: unreadByConversation.get(row.id) ?? 0
    };
  });

  const selectedConversation = peerId
    ? await prisma.conversation.findFirst({
        where: { OR: [{ memberAId: characterId, memberBId: peerId }, { memberAId: peerId, memberBId: characterId }] },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 120 } }
      })
    : null;

  const selectedPeer = peerId
    ? await prisma.character.findUnique({ where: { id: peerId }, include: { realmStage: { include: { realm: true } } } })
    : null;

  return {
    serverTime: new Date().toISOString(),
    counts,
    conversations: serializedConversations,
    selectedPeer: selectedPeer ? { id: selectedPeer.id, name: selectedPeer.name, avatar: selectedPeer.avatar, appearanceKey: selectedPeer.appearanceKey, realm: `${selectedPeer.realmStage.realm.name} ${selectedPeer.realmStage.name}` } : null,
    messages: selectedConversation
      ? selectedConversation.messages.map((message) => ({
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          body: message.body,
          createdAt: message.createdAt.toISOString()
        }) satisfies RealtimeMessage)
      : [],
    latestNotification: latestNotification ? {
      id: latestNotification.id,
      title: latestNotification.title,
      body: latestNotification.body,
      createdAt: latestNotification.createdAt.toISOString()
    } satisfies RealtimeNotification : null
  };
}
