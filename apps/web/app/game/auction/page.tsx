import { randomUUID } from "node:crypto";
import { AuctionParticipantStatus, AuctionPhase, AuctionStatus, prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { ItemDetailPanel, ItemSummaryCard } from "@/components/ItemCard";
import { auctionClassLabel, auctionPriceForRound, canAuctionItem } from "@ttg/game";
import { cancelAuctionAction, createAuctionAction, joinAuctionAction, passAuctionAction, raiseAuctionAction } from "@/lib/forms";

export default async function AuctionPage({ searchParams }: { searchParams?: Promise<{ tab?: string; detail?: string; sellItem?: string; error?: string; ok?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/");
  const params = await searchParams;
  const tab = params?.tab === "sell" || params?.tab === "my" ? params.tab : "live";
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      currentLocation: true,
      items: {
        where: { quantity: { gt: 0 }, equippedSlot: null },
        include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true } }, auctions: { where: { status: "ACTIVE" }, select: { id: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  const atMarket = Array.isArray(character.currentLocation?.services) && character.currentLocation.services.includes("auction");
  const [auctions, myAuctions] = await Promise.all([
    prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      take: 30,
      include: { item: { include: { template: true } }, seller: true, highestBidder: true, currentTurnParticipant: { include: { character: true } }, participants: { include: { character: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] }, bids: { include: { bidder: true }, orderBy: { round: "asc" } } },
      orderBy: [{ phase: "asc" }, { registrationEndsAt: "asc" }]
    }),
    prisma.auction.findMany({
      where: { sellerId: character.id },
      take: 30,
      include: { item: { include: { template: true } }, participants: true, highestBidder: true },
      orderBy: { startsAt: "desc" }
    })
  ]);
  const selectedAuction = auctions.find((auction) => auction.id === params?.detail) ?? auctions[0] ?? null;
  const sellableItems = character.items.filter((item) => canAuctionItem(item.template) && !item.bound && item.listings.length === 0 && item.auctions.length === 0);
  const selectedItem = sellableItems.find((item) => item.id === params?.sellItem) ?? sellableItems[0];

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Đấu Giá</p>
        <h1 className="mt-1 text-3xl font-black">Đấu Giá Trực Tiếp</h1>
        <p className="muted mt-2">Phiên trả giá theo lượt. Mỗi lần nâng cố định +30% giá khởi điểm, không nhập giá tự do.</p>
      </header>
      <ActionAlert message={params?.error} />
      <ActionAlert message={okMessage(params?.ok)} />
      {!atMarket ? (
        <section className="panel rounded-lg p-5 mb-5">
          <h2 className="text-xl font-bold text-gold">Bạn chưa ở khu Đấu Giá</h2>
          <p className="muted mt-2">Đấu giá chỉ mở khi nhân vật đứng tại địa điểm có dịch vụ Đấu Giá.</p>
          <Link href="/game/world" className="btn mt-4">Xem bản đồ</Link>
        </section>
      ) : null}

      <nav className="tab-row mb-5">
        <Link href="/game/auction" className={tab === "live" ? "active" : ""}>Phiên đấu</Link>
        <Link href={selectedItem ? `/game/auction?tab=sell&sellItem=${selectedItem.id}` : "/game/auction?tab=sell"} className={tab === "sell" ? "active" : ""}>Đưa lên sàn</Link>
        <Link href="/game/auction?tab=my" className={tab === "my" ? "active" : ""}>Phiên của tôi</Link>
      </nav>

      {tab === "live" ? <LiveAuctions auctions={auctions} selectedAuction={selectedAuction} characterId={character.id} balance={character.linhThach} disabled={!atMarket} /> : null}
      {tab === "sell" ? <SellAuctionTab items={sellableItems} selectedItem={selectedItem} disabled={!atMarket} /> : null}
      {tab === "my" ? <MyAuctionTab auctions={myAuctions} /> : null}
    </div>
  );
}

function LiveAuctions({ auctions, selectedAuction, characterId, balance, disabled }: { auctions: Array<any>; selectedAuction: any | null; characterId: string; balance: bigint; disabled: boolean }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <div className="panel rounded-lg p-5">
        <h2 className="text-xl font-bold text-gold">Danh sách phiên</h2>
        <div className="market-sell-list mt-4">
          {auctions.map((auction) => (
            <Link key={auction.id} href={`/game/auction?detail=${auction.id}`} className={selectedAuction?.id === auction.id ? "selected" : ""}>
              <b>{auction.item.template.name}</b>
              <small>{phaseLabel(auction.phase)} · hiện tại {formatAmount(auction.currentPrice || auction.startingPrice)}</small>
            </Link>
          ))}
          {auctions.length === 0 ? <p className="muted">Chưa có phiên đấu giá đang mở.</p> : null}
        </div>
      </div>
      <div className="panel rounded-lg p-5">
        {selectedAuction ? <AuctionDetail auction={selectedAuction} characterId={characterId} balance={balance} disabled={disabled} /> : <p className="muted">Chọn một phiên để xem chi tiết.</p>}
      </div>
    </section>
  );
}

function AuctionDetail({ auction, characterId, balance, disabled }: { auction: any; characterId: string; balance: bigint; disabled: boolean }) {
  const me = auction.participants.find((participant: any) => participant.characterId === characterId);
  const isSeller = auction.sellerId === characterId;
  const nextRound = auction.currentRound < 0 ? 0 : auction.currentRound + 1;
  const nextPrice = auctionPriceForRound(auction.startingPrice, nextRound);
  const currentPrice = auction.currentPrice > 0n ? auction.currentPrice : auction.startingPrice;
  const isMyTurn = auction.currentTurnParticipant?.characterId === characterId;
  const canJoin = auction.phase === AuctionPhase.OPEN_REGISTRATION && !me && !isSeller;
  const canAct = auction.phase === AuctionPhase.LIVE && me?.status === AuctionParticipantStatus.ACTIVE && isMyTurn && !isSeller;
  return (
    <ItemDetailPanel
      template={auction.item.template}
      quantityLabel={`x${auction.item.quantity}`}
      details={[
        { label: "Trạng thái", value: phaseLabel(auction.phase) },
        { label: "Người bán", value: auction.seller.name },
        { label: "Giá khởi điểm", value: <CurrencyAmount amount={auction.startingPrice} /> },
        { label: "Bước giá", value: <CurrencyAmount amount={auction.bidStep} /> },
        { label: "Giá hiện tại", value: <CurrencyAmount amount={currentPrice} /> },
        { label: "Lượt hiện tại", value: auction.currentTurnParticipant?.character.name ?? "Chưa bắt đầu" },
        { label: "Người dẫn đầu", value: auction.highestBidder?.name ?? "Chưa có" },
        { label: "Số người tham gia", value: auction.participants.length.toLocaleString("vi-VN") }
      ]}
      action={
        <div className="auction-action-box">
          <p className="muted">{statusText(auction, me, isSeller, isMyTurn)}</p>
          {canJoin ? <JoinAuctionForm auction={auction} balance={balance} disabled={disabled} /> : null}
          {canAct ? <TurnActionForms auction={auction} nextPrice={nextPrice} disabled={disabled} balance={balance} /> : null}
          <AuctionLog auction={auction} />
        </div>
      }
    />
  );
}

function JoinAuctionForm({ auction, balance, disabled }: { auction: any; balance: bigint; disabled: boolean }) {
  const blocked = disabled || balance < auction.startingPrice;
  return (
    <form action={joinAuctionAction} className="item-card-action">
      <input type="hidden" name="auctionId" value={auction.id} />
      <input type="hidden" name="actionKey" value={randomUUID()} />
      <button className="btn w-full" disabled={blocked}>{blocked ? "Không đủ điều kiện" : `Tham gia ${formatAmount(auction.startingPrice)}`}</button>
    </form>
  );
}

function TurnActionForms({ auction, nextPrice, disabled, balance }: { auction: any; nextPrice: bigint; disabled: boolean; balance: bigint }) {
  const currentHold = auction.currentTurnParticipant?.lastBidPrice ?? 0n;
  const needMore = nextPrice > currentHold ? nextPrice - currentHold : 0n;
  const blocked = disabled || balance < needMore;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={raiseAuctionAction} className="item-card-action">
        <input type="hidden" name="auctionId" value={auction.id} />
        <input type="hidden" name="actionKey" value={randomUUID()} />
        <button className="btn w-full" disabled={blocked}>{blocked ? "Không đủ Linh Thạch" : `Nâng lên ${formatAmount(nextPrice)}`}</button>
      </form>
      <form action={passAuctionAction} className="item-card-action">
        <input type="hidden" name="auctionId" value={auction.id} />
        <input type="hidden" name="actionKey" value={randomUUID()} />
        <button className="btn btn-secondary w-full" disabled={disabled}>Bỏ Qua</button>
      </form>
    </div>
  );
}

function AuctionLog({ auction }: { auction: any }) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <h4 className="font-bold text-gold">Nhật ký đấu giá</h4>
      <div className="mt-2 space-y-2 text-sm">
        {auction.bids.map((bid: any) => <p key={bid.id}>{bid.bidder.name} nâng giá lên {formatAmount(bid.amount)}.</p>)}
        {auction.bids.length === 0 ? <p className="muted">Chưa có lượt trả giá.</p> : null}
      </div>
    </div>
  );
}

function SellAuctionTab({ items, selectedItem, disabled }: { items: Array<any>; selectedItem: any | undefined; disabled: boolean }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <div className="panel rounded-lg p-5">
        <h2 className="text-xl font-bold text-gold">Vật phẩm đủ điều kiện</h2>
        <div className="market-sell-list mt-4">
          {items.map((item) => (
            <Link key={item.id} href={`/game/auction?tab=sell&sellItem=${item.id}`} className={selectedItem?.id === item.id ? "selected" : ""}>
              <b>{item.template.name}</b>
              <small>{auctionClassLabel(item.template) || "Được đấu giá"} · x{item.quantity}</small>
            </Link>
          ))}
          {items.length === 0 ? <p className="muted">Không có vật phẩm đủ điều kiện đấu giá. Trang bị cần đạt Trân Phẩm.</p> : null}
        </div>
      </div>
      <div className="panel rounded-lg p-5">
        {selectedItem ? (
          <ItemDetailPanel
            template={selectedItem.template}
            quantityLabel={`x${selectedItem.quantity}`}
            details={[
              { label: "Hạng", value: auctionClassLabel(selectedItem.template) || "Đấu giá thường" },
              { label: "Điều kiện", value: "Có thể đưa lên Đấu Giá" }
            ]}
            action={<CreateAuctionForm item={selectedItem} disabled={disabled} />}
          />
        ) : <p className="muted">Chọn vật phẩm để tạo phiên.</p>}
      </div>
    </section>
  );
}

function CreateAuctionForm({ item, disabled }: { item: any; disabled: boolean }) {
  return (
    <form action={createAuctionAction} className="grid gap-3">
      <input type="hidden" name="itemId" value={item.id} />
      <label>Giá khởi điểm<input className="field" name="startingPrice" inputMode="numeric" min="1" defaultValue="100000" required /></label>
      <button className="btn" disabled={disabled}>Mở phiên đấu giá</button>
      <small className="muted">Người tham gia sẽ đăng ký trong 5 phút, sau đó trả giá theo lượt 60 giây.</small>
    </form>
  );
}

function MyAuctionTab({ auctions }: { auctions: Array<any> }) {
  return (
    <section className="market-card-grid">
      {auctions.map((auction) => (
        <ItemSummaryCard
          key={auction.id}
          template={auction.item.template}
          quantityLabel={`x${auction.item.quantity}`}
          priceLabel={<CurrencyAmount amount={auction.currentPrice > 0n ? auction.currentPrice : auction.startingPrice} />}
          href={`/game/auction?detail=${auction.id}`}
          sellerLabel={phaseLabel(auction.phase)}
          action={auction.phase === AuctionPhase.OPEN_REGISTRATION && auction.participants.length === 0 ? <CancelAuctionForm auctionId={auction.id} /> : null}
        />
      ))}
      {auctions.length === 0 ? <div className="empty-state panel rounded-lg p-5"><b>Chưa có phiên đấu giá.</b><p>Chọn vật phẩm đủ điều kiện để mở phiên mới.</p></div> : null}
    </section>
  );
}

function CancelAuctionForm({ auctionId }: { auctionId: string }) {
  return (
    <form action={cancelAuctionAction} className="item-card-action">
      <input type="hidden" name="auctionId" value={auctionId} />
      <button className="btn btn-secondary w-full">Hủy phiên</button>
    </form>
  );
}

function phaseLabel(phase: string) {
  return ({
    OPEN_REGISTRATION: "Đang chờ người tham gia",
    LIVE: "Đang trả giá",
    SETTLED: "Đã kết thúc",
    CANCELLED: "Đã hủy"
  } as Record<string, string>)[phase] ?? phase;
}

function statusText(auction: any, me: any, isSeller: boolean, isMyTurn: boolean) {
  if (isSeller) return "Bạn là người bán, chỉ có thể theo dõi phiên.";
  if (!me && auction.phase === AuctionPhase.OPEN_REGISTRATION) return "Bạn có thể tham gia bằng giá khởi điểm.";
  if (!me) return "Phiên đã bắt đầu, không thể tham gia thêm.";
  if (me.status === AuctionParticipantStatus.PASSED) return "Bạn đã rút khỏi phiên đấu giá này.";
  if (auction.phase === AuctionPhase.OPEN_REGISTRATION) return "Bạn đã tham gia. Chờ hết thời gian đăng ký để bắt đầu trả giá.";
  if (isMyTurn) return "Đến lượt bạn quyết định.";
  return auction.currentTurnParticipant?.character?.name ? `Đang chờ ${auction.currentTurnParticipant.character.name} quyết định...` : "Đang chờ lượt kế tiếp.";
}

function okMessage(ok?: string) {
  return ({
    "auction-created": "Đã mở phiên đấu giá.",
    joined: "Đã tham gia phiên đấu giá.",
    raised: "Đã nâng giá.",
    passed: "Đã rút khỏi phiên đấu giá.",
    cancelled: "Đã hủy phiên đấu giá."
  } as Record<string, string | undefined>)[ok ?? ""] ?? ok;
}

function formatAmount(amount: bigint) {
  return `${amount.toLocaleString("vi-VN")} Linh Thạch`;
}
