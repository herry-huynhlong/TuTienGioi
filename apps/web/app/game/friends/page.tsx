import { ActionAlert } from "@/components/ActionAlert";
import { getUser } from "@/lib/auth";
import { acceptFriendRequestAction, blockPlayerAction, cancelFriendRequestAction, rejectFriendRequestAction, removeFriendAction, sendFriendRequestAction } from "@/lib/forms";
import { prisma } from "@ttg/db";
import { MessageSquare, Search, ShieldOff, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FriendsPage({ searchParams }: { searchParams?: Promise<{ q?: string; error?: string; ok?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user?.character) redirect("/");
  const characterId = user.character.id;
  const q = params?.q?.trim() ?? "";
  const [me, incoming, outgoing, blocked, searchResults] = await Promise.all([
    prisma.character.findUniqueOrThrow({
      where: { id: characterId },
      include: {
        friendshipsA: { include: { memberB: { include: { realmStage: { include: { realm: true } } } } }, orderBy: { createdAt: "desc" } },
        friendshipsB: { include: { memberA: { include: { realmStage: { include: { realm: true } } } } }, orderBy: { createdAt: "desc" } }
      }
    }),
    prisma.friendRequest.findMany({ where: { addresseeId: characterId, status: "PENDING" }, include: { requester: { include: { realmStage: { include: { realm: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.friendRequest.findMany({ where: { requesterId: characterId, status: "PENDING" }, include: { addressee: { include: { realmStage: { include: { realm: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.blockedPlayer.findMany({ where: { blockerId: characterId }, include: { blocked: true }, orderBy: { createdAt: "desc" } }),
    q ? prisma.character.findMany({
      where: { id: { not: characterId }, OR: [{ name: { contains: q, mode: "insensitive" } }, { id: q }] },
      include: { realmStage: { include: { realm: true } } },
      take: 12,
      orderBy: { name: "asc" }
    }) : []
  ]);
  const friends = [...me.friendshipsA.map((row) => row.memberB), ...me.friendshipsB.map((row) => row.memberA)];
  const friendIds = new Set(friends.map((friend) => friend.id));
  const pendingOutIds = new Set(outgoing.map((request) => request.addresseeId));
  const blockedIds = new Set(blocked.map((row) => row.blockedId));

  return (
    <div className="social-page p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Xã Hội</p>
        <h1 className="mt-1 text-3xl font-black">Bạn Bè</h1>
        <p className="muted mt-2">Kết giao, tìm người chơi và quản lý lời mời.</p>
      </header>
      <ActionAlert message={params?.error} />
      {params?.ok ? <ActionAlert message={okMessage(params.ok)} /> : null}

      <section className="social-grid">
        <Panel title="Danh sách bạn bè" icon={<Users size={18} aria-hidden />}>
          <div className="social-list">
            {friends.map((friend) => <PlayerRow key={friend.id} player={friend} relation="Bạn bè" actions={<FriendActions friendId={friend.id} />} />)}
            {friends.length === 0 ? <Empty text="Chưa có bằng hữu. Hãy tìm người chơi và gửi lời mời." /> : null}
          </div>
        </Panel>

        <Panel title="Lời mời kết bạn" icon={<UserPlus size={18} aria-hidden />}>
          <div className="social-list">
            {incoming.map((request) => (
              <PlayerRow key={request.id} player={request.requester} relation="Muốn kết bạn" actions={<RequestActions requestId={request.id} />} />
            ))}
            {outgoing.map((request) => (
              <PlayerRow key={request.id} player={request.addressee} relation="Đã gửi lời mời" actions={<CancelRequest requestId={request.id} />} />
            ))}
            {incoming.length + outgoing.length === 0 ? <Empty text="Không có lời mời đang chờ." /> : null}
          </div>
        </Panel>

        <Panel title="Tìm người chơi" icon={<Search size={18} aria-hidden />}>
          <form className="social-search">
            <input className="field" name="q" defaultValue={q} placeholder="Tên nhân vật hoặc ID..." />
            <button className="btn">Tìm</button>
          </form>
          <div className="social-list mt-4">
            {searchResults.map((player) => {
              const relation = friendIds.has(player.id) ? "Bạn bè" : pendingOutIds.has(player.id) ? "Đã gửi lời mời" : blockedIds.has(player.id) ? "Đã chặn" : "Người chơi";
              return <PlayerRow key={player.id} player={player} relation={relation} actions={<SearchActions playerId={player.id} disabled={friendIds.has(player.id) || pendingOutIds.has(player.id) || blockedIds.has(player.id)} />} />;
            })}
            {q && searchResults.length === 0 ? <Empty text="Không tìm thấy người chơi phù hợp." /> : null}
          </div>
        </Panel>

        <Panel title="Đã chặn" icon={<ShieldOff size={18} aria-hidden />}>
          <div className="social-list">
            {blocked.map((row) => <div key={row.id} className="social-row"><div><b>{row.blocked.name}</b><small>Không thể nhắn tin, kết bạn hoặc gửi tài sản.</small></div></div>)}
            {blocked.length === 0 ? <Empty text="Danh sách chặn đang trống." /> : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel rounded-lg p-5"><h2 className="social-panel-title">{icon}{title}</h2><div className="mt-4">{children}</div></section>;
}

function PlayerRow({ player, relation, actions }: { player: any; relation: string; actions: React.ReactNode }) {
  return (
    <article className="social-row">
      <div className="social-avatar">{player.avatar ? <img src={player.avatar} alt="" /> : player.name.slice(0, 1)}</div>
      <div>
        <b>{player.name}</b>
        <small>{player.realmStage ? `${player.realmStage.realm.name} ${player.realmStage.name}` : "Tu sĩ"} · {relation}</small>
      </div>
      <div className="social-actions">{actions}</div>
    </article>
  );
}

function FriendActions({ friendId }: { friendId: string }) {
  return (
    <>
      <Link href={`/game/chat?with=${friendId}`} className="btn btn-secondary"><MessageSquare size={14} aria-hidden /> Nhắn</Link>
      <form action={removeFriendAction}><input type="hidden" name="friendId" value={friendId} /><button className="btn btn-secondary">Hủy bạn</button></form>
      <form action={blockPlayerAction}><input type="hidden" name="targetId" value={friendId} /><input type="hidden" name="back" value="/game/friends" /><button className="btn btn-secondary">Chặn</button></form>
    </>
  );
}

function RequestActions({ requestId }: { requestId: string }) {
  return (
    <>
      <form action={acceptFriendRequestAction}><input type="hidden" name="requestId" value={requestId} /><button className="btn">Chấp nhận</button></form>
      <form action={rejectFriendRequestAction}><input type="hidden" name="requestId" value={requestId} /><button className="btn btn-secondary">Từ chối</button></form>
    </>
  );
}

function CancelRequest({ requestId }: { requestId: string }) {
  return <form action={cancelFriendRequestAction}><input type="hidden" name="requestId" value={requestId} /><button className="btn btn-secondary">Hủy lời mời</button></form>;
}

function SearchActions({ playerId, disabled }: { playerId: string; disabled: boolean }) {
  return (
    <>
      <Link href={`/game/chat?with=${playerId}`} className="btn btn-secondary">Nhắn tin</Link>
      <form action={sendFriendRequestAction}><input type="hidden" name="targetId" value={playerId} /><button className="btn" disabled={disabled}>Kết bạn</button></form>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="muted">{text}</p>;
}

function okMessage(ok: string) {
  return ({ request: "Đã gửi lời mời kết bạn.", friend: "Đã trở thành bằng hữu.", removed: "Đã hủy kết bạn.", blocked: "Đã chặn người chơi." } as Record<string, string>)[ok] ?? ok;
}
