import { randomUUID } from "node:crypto";
import { AuctionParticipantStatus, AuctionPhase, AuctionStatus, prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { AuctionCreatePanel } from "@/components/AuctionCreatePanel";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { GamePageBackground } from "@/components/GamePageBackground";
import { ItemDetailPanel, ItemSummaryCard } from "@/components/ItemCard";
import { AUCTION_LIVE_GAME_DAYS, AUCTION_REGISTRATION_GAME_DAYS, auctionPriceForRound, canAuctionItem, economyFeatureUnlockReasons, hasReachedLuyenKhi1, processAuctionHouse } from "@ttg/game";
import { cancelAuctionAction, joinAuctionAction, passAuctionAction, raiseAuctionAction } from "@/lib/forms";

type AuctionTab = "upcoming" | "live" | "ended" | "sell" | "my";

export default async function AuctionPage({ searchParams }: { searchParams?: Promise<{ tab?: string; detail?: string; sellItem?: string; error?: string; ok?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/");
  const params = await searchParams;
  const tab: AuctionTab = params?.tab === "live" || params?.tab === "ended" || params?.tab === "sell" || params?.tab === "my" ? params.tab : "upcoming";
  const now = new Date();
  await processAuctionHouse(prisma, now);
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      realmStage: { include: { realm: true } },
      items: {
        where: { quantity: { gt: 0 } },
        include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true } }, auctions: { where: { status: "ACTIVE" }, select: { id: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!hasReachedLuyenKhi1(character)) redirect(`/game?error=${encodeURIComponent(economyFeatureUnlockReasons.auction)}`);
  const [activeAuctions, endedAuctions, myAuctions, economyConfig] = await Promise.all([
    prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      take: 30,
      include: { item: { include: { template: true } }, seller: true, highestBidder: true, currentTurnParticipant: { include: { character: true } }, participants: { include: { character: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] }, bids: { include: { bidder: true }, orderBy: { round: "asc" } } },
      orderBy: [{ phase: "asc" }, { registrationEndsAt: "asc" }]
    }),
    prisma.auction.findMany({
      where: { status: { in: [AuctionStatus.SETTLED, AuctionStatus.CANCELLED] } },
      take: 30,
      include: { item: { include: { template: true } }, seller: true, highestBidder: true, currentTurnParticipant: { include: { character: true } }, participants: { include: { character: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] }, bids: { include: { bidder: true }, orderBy: { round: "asc" } } },
      orderBy: { settledAt: "desc" }
    }),
    prisma.auction.findMany({
      where: { sellerId: character.id },
      take: 30,
      include: { item: { include: { template: true } }, participants: true, highestBidder: true },
      orderBy: { startsAt: "desc" }
    }),
    prisma.gameConfig.findUnique({ where: { key: "economy" } })
  ]);
  const auctionFeeBps = configNumber(economyConfig?.value, "auctionFeeBps", 300);
  const upcomingAuctions = activeAuctions.filter((auction) => auction.phase === AuctionPhase.OPEN_REGISTRATION);
  const liveAuctions = activeAuctions.filter((auction) => auction.phase === AuctionPhase.LIVE);
  const visibleAuctions = tab === "live" ? liveAuctions : tab === "ended" ? endedAuctions : upcomingAuctions;
  const selectedAuction = visibleAuctions.find((auction) => auction.id === params?.detail) ?? visibleAuctions[0] ?? null;
  const auctionItems = character.items.map((item) => ({ ...item, auctionDisabledReason: auctionEligibilityReason(item) }));
  const sellableItems = auctionItems.filter((item) => !item.auctionDisabledReason);
  const selectedItem = sellableItems.find((item) => item.id === params?.sellItem) ?? sellableItems[0];

  return (
    <GamePageBackground type="auction">
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Đấu Giá</p>
        <h1 className="mt-1 text-3xl font-black">Đấu Giá Trực Tiếp</h1>
        <p className="muted mt-2">Hệ thống đấu giá toàn cục. Vật phẩm lên sàn chờ đăng ký {AUCTION_REGISTRATION_GAME_DAYS} ngày game, sau đó mở đấu tối đa {AUCTION_LIVE_GAME_DAYS} ngày game.</p>
      </header>
      <ActionAlert message={params?.error} />
      <ActionAlert message={okMessage(params?.ok)} />

      <nav className="tab-row mb-5">
        <Link href="/game/auction" className={tab === "upcoming" ? "active" : ""}>Sắp đấu giá</Link>
        <Link href="/game/auction?tab=live" className={tab === "live" ? "active" : ""}>Đang đấu giá</Link>
        <Link href="/game/auction?tab=ended" className={tab === "ended" ? "active" : ""}>Đã kết thúc</Link>
        <Link href={selectedItem ? `/game/auction?tab=sell&sellItem=${selectedItem.id}` : "/game/auction?tab=sell"} className={tab === "sell" ? "active" : ""}>Đưa lên sàn</Link>
        <Link href="/game/auction?tab=my" className={tab === "my" ? "active" : ""}>Phiên của tôi</Link>
      </nav>

      {tab === "upcoming" || tab === "live" || tab === "ended" ? <AuctionList tab={tab} auctions={visibleAuctions} selectedAuction={selectedAuction} characterId={character.id} balance={character.linhThach} now={now} /> : null}
      {tab === "sell" ? <SellAuctionTab items={auctionItems} selectedItem={selectedItem} auctionFeeBps={auctionFeeBps} /> : null}
      {tab === "my" ? <MyAuctionTab auctions={myAuctions} now={now} /> : null}
    </div>
    </GamePageBackground>
  );
}

function AuctionList({ tab, auctions, selectedAuction, characterId, balance, now }: { tab: AuctionTab; auctions: Array<any>; selectedAuction: any | null; characterId: string; balance: bigint; now: Date }) {
  const title = tab === "live" ? "Đang đấu giá" : tab === "ended" ? "Đã kết thúc" : "Sắp đấu giá";
  const empty = tab === "live" ? "Chưa có phiên đang đấu giá." : tab === "ended" ? "Chưa có phiên đã kết thúc." : "Chưa có phiên đang chờ đăng ký.";
  return (
    <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <div className="panel rounded-lg p-5">
        <h2 className="text-xl font-bold text-gold">{title}</h2>
        <div className="market-sell-list mt-4">
          {auctions.map((auction) => (
            <Link key={auction.id} href={`/game/auction${tab === "upcoming" ? "" : `?tab=${tab}`}${tab === "upcoming" ? "?" : "&"}detail=${auction.id}`} className={selectedAuction?.id === auction.id ? "selected" : ""}>
              <b>{auction.item.template.name}</b>
              <small>{phaseLabel(auction.phase)} · {auctionTimeLabel(auction, now)} · {auction.participants.length} đăng ký</small>
            </Link>
          ))}
          {auctions.length === 0 ? <p className="muted">{empty}</p> : null}
        </div>
      </div>
      <div className="panel rounded-lg p-5">
        {selectedAuction ? <AuctionDetail auction={selectedAuction} characterId={characterId} balance={balance} now={now} /> : <p className="muted">Chọn một phiên để xem chi tiết.</p>}
      </div>
    </section>
  );
}

function AuctionDetail({ auction, characterId, balance, now }: { auction: any; characterId: string; balance: bigint; now: Date }) {
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
        { label: "Thời gian", value: auctionTimeLabel(auction, now) },
        { label: "Lượt hiện tại", value: auction.currentTurnParticipant?.character.name ?? "Chưa bắt đầu" },
        { label: "Người dẫn đầu", value: auction.highestBidder?.name ?? "Chưa có" },
        { label: "Đã đăng ký", value: auction.participants.length.toLocaleString("vi-VN") }
      ]}
      action={
        <div className="auction-action-box">
          <p className="muted">{statusText(auction, me, isSeller, isMyTurn)}</p>
          {canJoin ? <JoinAuctionForm auction={auction} /> : null}
          {canAct ? <TurnActionForms auction={auction} nextPrice={nextPrice} balance={balance} /> : null}
          <AuctionLog auction={auction} />
        </div>
      }
    />
  );
}

function JoinAuctionForm({ auction }: { auction: any }) {
  return (
    <form action={joinAuctionAction} className="item-card-action">
      <input type="hidden" name="auctionId" value={auction.id} />
      <input type="hidden" name="actionKey" value={randomUUID()} />
      <button className="btn w-full">Đăng ký tham gia</button>
    </form>
  );
}

function TurnActionForms({ auction, nextPrice, balance }: { auction: any; nextPrice: bigint; balance: bigint }) {
  const currentHold = auction.currentTurnParticipant?.lastBidPrice ?? 0n;
  const needMore = nextPrice > currentHold ? nextPrice - currentHold : 0n;
  const blocked = balance < needMore;
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
        <button className="btn btn-secondary w-full">Bỏ Qua</button>
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

function SellAuctionTab({ items, selectedItem, auctionFeeBps }: { items: Array<any>; selectedItem: any | undefined; auctionFeeBps: number }) {
  return (
    <AuctionCreatePanel items={items} selectedItem={selectedItem} feeBps={auctionFeeBps} registrationDays={AUCTION_REGISTRATION_GAME_DAYS} liveDays={AUCTION_LIVE_GAME_DAYS} />
  );
}

function MyAuctionTab({ auctions, now }: { auctions: Array<any>; now: Date }) {
  return (
    <section className="market-card-grid">
      {auctions.map((auction) => (
        <ItemSummaryCard
          key={auction.id}
          template={auction.item.template}
          quantityLabel={`x${auction.item.quantity}`}
          priceLabel={<CurrencyAmount amount={auction.currentPrice > 0n ? auction.currentPrice : auction.startingPrice} />}
          href={`/game/auction?detail=${auction.id}`}
          sellerLabel={`${phaseLabel(auction.phase)} · ${auctionTimeLabel(auction, now)}`}
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
    OPEN_REGISTRATION: "Đang đăng ký",
    LIVE: "Đang trả giá",
    SETTLED: "Đã kết thúc",
    CANCELLED: "Không bán được"
  } as Record<string, string>)[phase] ?? phase;
}

function auctionEligibilityReason(item: any) {
  if (item.equippedSlot) return "Vật phẩm này không thể đưa lên đấu giá.";
  if (item.bound || !item.template.tradeable) return "Vật phẩm này không thể đưa lên đấu giá.";
  if (item.template.category === "QUEST") return "Vật phẩm này không thể đưa lên đấu giá.";
  if (item.listings.length > 0) return "Vật phẩm đang được rao bán.";
  if (item.auctions.length > 0) return "Vật phẩm đang trong phiên đấu giá.";
  if (!canAuctionItem(item.template)) return item.template.category === "EQUIPMENT" ? "Trang bị cần đạt Trân Phẩm để đấu giá." : "Vật phẩm này không thể đưa lên đấu giá.";
  return "";
}

function configNumber(value: unknown, key: string, fallback: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function statusText(auction: any, me: any, isSeller: boolean, isMyTurn: boolean) {
  if (isSeller) return "Bạn là người bán, chỉ có thể theo dõi phiên.";
  if (!me && auction.phase === AuctionPhase.OPEN_REGISTRATION) return "Bạn có thể đăng ký slot tham gia. Đăng ký chưa giữ tiền.";
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

function auctionTimeLabel(auction: any, now: Date) {
  if (auction.phase === AuctionPhase.OPEN_REGISTRATION) return `Mở sau ${formatDuration(auction.registrationEndsAt.getTime() - now.getTime())}`;
  if (auction.phase === AuctionPhase.LIVE) return `Kết thúc sau ${formatDuration(auction.endsAt.getTime() - now.getTime())}`;
  return auction.settledAt ? `Kết thúc ${auction.settledAt.toLocaleString("vi-VN")}` : "Đã khép lại";
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}
