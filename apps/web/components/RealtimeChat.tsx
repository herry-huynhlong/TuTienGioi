"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { RealtimeConversation, RealtimeMessage } from "@/lib/realtime";
import Link from "next/link";
import { Ban, Gem, MessageSquare, Send, Users } from "lucide-react";
import { CurrencyAmount } from "@/components/CurrencyAmount";

type ChatSnapshot = {
  conversations: RealtimeConversation[];
  selectedPeer: { id: string; name: string; realm: string } | null;
  messages: RealtimeMessage[];
};

type TransferItem = {
  id: string;
  name: string;
  rarity: string;
  category: string;
  quantity: number;
  stackable: boolean;
  priceAmount: string;
};

export function RealtimeChat({
  characterId,
  selectedPeerId,
  initialSnapshot,
  canTransfer,
  isBlocked,
  linhThach,
  transferableItems
}: {
  characterId: string;
  selectedPeerId: string;
  initialSnapshot: ChatSnapshot;
  canTransfer: boolean;
  isBlocked: boolean;
  linhThach: string;
  transferableItems: TransferItem[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedConversation = useMemo(() => snapshot.conversations.find((row) => row.peerId === selectedPeerId), [snapshot.conversations, selectedPeerId]);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    const url = selectedPeerId ? `/api/realtime?with=${encodeURIComponent(selectedPeerId)}` : "/api/realtime";
    const source = new EventSource(url);
    source.addEventListener("snapshot", (event) => {
      const next = JSON.parse((event as MessageEvent).data) as ChatSnapshot;
      setSnapshot({ conversations: next.conversations, selectedPeer: next.selectedPeer, messages: next.messages });
    });
    return () => source.close();
  }, [selectedPeerId]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    fetch("/api/social/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedConversation.id })
    }).catch(() => undefined);
  }, [selectedConversation?.id, snapshot.messages.length]);

  const sendMessage = () => {
    const text = body.trim();
    if (!text || !selectedPeerId) return;
    setError("");
    startTransition(() => {
      void (async () => {
        const res = await fetch("/api/social/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiverId: selectedPeerId, body: text })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) setError(String(json.error ?? "Không gửi được tin nhắn."));
        else setBody("");
      })();
    });
  };

  return (
    <section className="chat-shell">
      <aside className="chat-conversations panel">
        <div className="chat-panel-title"><MessageSquare size={17} aria-hidden /> Hội thoại</div>
        {snapshot.conversations.length > 0 ? snapshot.conversations.map((row) => (
          <Link key={row.id} href={`/game/chat?with=${row.peerId}`} className={`conversation-row ${selectedPeerId === row.peerId ? "active" : ""}`}>
            <div className="social-avatar">{row.peerName.slice(0, 1)}</div>
            <div>
              <b>{row.peerName}</b>
              <small>{row.lastMessage || "Chưa có tin nhắn"}</small>
            </div>
            {row.unread > 0 ? <span className="unread-badge">{row.unread}</span> : null}
          </Link>
        )) : (
          <div className="empty-state compact">
            <b>Chưa có hội thoại.</b>
            <p>Tìm người chơi trong Bạn Bè để bắt đầu nhắn tin.</p>
            <Link href="/game/friends" className="btn btn-secondary mt-3">Tìm người chơi</Link>
          </div>
        )}
      </aside>

      <main className="chat-thread panel">
        {snapshot.selectedPeer ? (
          <>
            <div className="chat-thread-head">
              <div>
                <p className="text-xs font-bold uppercase text-jade">Đang trò chuyện</p>
                <h2>{snapshot.selectedPeer.name}</h2>
                <small>{snapshot.selectedPeer.realm} · {canTransfer ? "Bạn bè" : "Chưa kết bạn"}</small>
              </div>
              <div className="flex gap-2">
                <Link href="/game/friends" className="btn btn-secondary"><Users size={14} aria-hidden /> Bạn bè</Link>
                <Link href="/game/friends" className="btn btn-secondary"><Ban size={14} aria-hidden /> Chặn</Link>
              </div>
            </div>
            {error ? <div className="blocked-note">{error}</div> : null}
            <div className="message-list">
              {snapshot.messages.length ? snapshot.messages.map((message) => (
                <article key={message.id} className={`message-bubble ${message.senderId === characterId ? "mine" : ""}`}>
                  <p>{message.body}</p>
                  <small>{new Date(message.createdAt).toLocaleString("vi-VN")}</small>
                </article>
              )) : <p className="muted">Chưa có tin nhắn. Gửi lời chào trước đi.</p>}
            </div>
            {isBlocked ? (
              <div className="blocked-note">Hai bên đang có trạng thái chặn, không thể gửi tin nhắn hoặc tài sản.</div>
            ) : (
              <div className="message-form">
                <textarea className="field" value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="Nhập tin nhắn..." maxLength={1000} />
                <button className="btn" onClick={sendMessage} disabled={pending || !body.trim()}><Send size={15} aria-hidden /> {pending ? "Đang gửi..." : "Gửi"}</button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <b>Chọn một hội thoại.</b>
            <p>Tin nhắn cá nhân được lưu trong database. Realtime chỉ là lớp cập nhật UI.</p>
          </div>
        )}
      </main>

      <aside className="chat-transfer panel">
        <div className="chat-panel-title"><Gem size={17} aria-hidden /> Gửi tài sản</div>
        {snapshot.selectedPeer ? (
          canTransfer ? (
            <div className="asset-transfer-stack">
              <CurrencyTransfer receiverId={snapshot.selectedPeer.id} balance={linhThach} />
              <ItemTransfer receiverId={snapshot.selectedPeer.id} items={transferableItems} />
            </div>
          ) : (
            <p className="muted">Chỉ bạn bè mới có thể gửi Linh Thạch hoặc vật phẩm.</p>
          )
        ) : (
          <p className="muted">Chọn người nhận để mở chuyển tài sản.</p>
        )}
      </aside>
    </section>
  );
}

function CurrencyTransfer({ receiverId, balance }: { receiverId: string; balance: string }) {
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const balanceLabel = BigInt(balance).toLocaleString("vi-VN");
  return (
    <div className="transfer-box">
      <h3>Linh Thạch</h3>
      <p className="muted">Số dư: <CurrencyAmount amount={balanceLabel.replace(/\D/g, "") || "0"} />.</p>
      {error ? <small className="quantity-disabled-reason">{error}</small> : null}
      <div className="quantity-control">
        <button type="button" onClick={() => setAmount((value) => Math.max(1, value - 1))}>-</button>
        <input className="field" type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value || 1)))} />
        <button type="button" onClick={() => setAmount((value) => value + 1)}>+</button>
      </div>
      <button className="btn btn-secondary" disabled={pending} onClick={() => startTransition(() => { void postTransfer("/api/social/transfer/currency", { receiverId, amount }, setError); })}>{pending ? "Đang gửi..." : "Gửi Linh Thạch"}</button>
    </div>
  );
}

function ItemTransfer({ receiverId, items }: { receiverId: string; items: TransferItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = items.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? "");
      setQuantity(1);
    }
  }, [items, selectedId]);
  if (!items.length) return <div className="transfer-box"><h3>Vật phẩm</h3><p className="muted">Không có vật phẩm đủ điều kiện gửi.</p></div>;
  return (
    <div className="transfer-box">
      <h3>Vật phẩm</h3>
      {error ? <small className="quantity-disabled-reason">{error}</small> : null}
      <div className="transfer-item-list">
        {items.map((item) => (
          <button key={item.id} type="button" className={`transfer-item-card ${item.id === selectedId ? "selected" : ""}`} onClick={() => { setSelectedId(item.id); setQuantity(1); }}>
            <b>{item.name}</b>
            <small>{item.rarity} · {item.category} · x{item.quantity}</small>
            <span><CurrencyAmount amount={item.priceAmount} /></span>
          </button>
        ))}
      </div>
      {selected ? (
        <>
          <div className="quantity-control mt-3">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
            <input className="field" type="number" min={1} max={selected.stackable ? selected.quantity : 1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(selected.stackable ? selected.quantity : 1, Number(event.target.value || 1))))} />
            <button type="button" onClick={() => setQuantity((value) => Math.min(selected.stackable ? selected.quantity : 1, value + 1))}>+</button>
          </div>
          <button className="btn btn-secondary mt-3" disabled={pending} onClick={() => startTransition(() => { void postTransfer("/api/social/transfer/item", { receiverId, itemId: selected.id, quantity }, setError); })}>{pending ? "Đang gửi..." : "Gửi vật phẩm"}</button>
        </>
      ) : null}
    </div>
  );
}

async function postTransfer(url: string, body: Record<string, unknown>, setError: (value: string) => void) {
  setError("");
  const transactionKey = crypto.randomUUID();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, transactionKey })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) setError(String(json.error ?? "Không thể gửi tài sản."));
}
