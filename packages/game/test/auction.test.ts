import { describe, expect, it, vi } from "vitest";
import { AuctionPhase, AuctionStatus, ItemCategory } from "@ttg/db";
import { AUCTION_LIVE_GAME_DAYS, AUCTION_LIVE_MS, AUCTION_REGISTRATION_GAME_DAYS, AUCTION_REGISTRATION_MS, REAL_MS_PER_GAME_DAY, auctionPriceForRound, canAuctionItem, createAuction, getItemEconomy, joinAuction, raiseAuction } from "../src/index.js";

describe("turn based auction rules", () => {
  it("uses a fixed +30% step from the starting price", () => {
    const start = 100000n;
    expect([0, 1, 2, 3, 4].map((round) => auctionPriceForRound(start, round))).toEqual([100000n, 130000n, 160000n, 190000n, 220000n]);
  });

  it("uses game-day based registration and live windows", () => {
    expect(AUCTION_REGISTRATION_GAME_DAYS).toBe(7);
    expect(AUCTION_LIVE_GAME_DAYS).toBe(1);
    expect(AUCTION_REGISTRATION_MS).toBe(7 * REAL_MS_PER_GAME_DAY);
    expect(AUCTION_LIVE_MS).toBe(REAL_MS_PER_GAME_DAY);
  });

  it("requires premium auction class for equipment but not for eligible materials", () => {
    const standardEquipment = {
      category: "EQUIPMENT",
      rarity: "THUONG",
      tradeable: true,
      equipSlot: "WEAPON",
      itemFamily: null,
      baseModifiers: { attack: 10 },
      bindRules: { auctionEligible: true, auctionClass: "STANDARD" }
    };
    const premiumEquipment = { ...standardEquipment, bindRules: { auctionEligible: true, auctionClass: "PREMIUM" } };
    const rareMaterial = {
      category: "MATERIAL",
      rarity: "THUONG",
      tradeable: true,
      itemFamily: null,
      baseModifiers: {},
      bindRules: { auctionEligible: true, auctionClass: "STANDARD" }
    };

    expect(canAuctionItem(standardEquipment)).toBe(false);
    expect(canAuctionItem(premiumEquipment)).toBe(true);
    expect(canAuctionItem(rareMaterial)).toBe(true);
    expect(getItemEconomy(premiumEquipment).auctionClass).toBe("PREMIUM");
  });

  it("creates new auctions in registration using game-day windows", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const created = { id: "auction-1" };
    const tx: any = {
      itemInstance: {
        findUnique: vi.fn().mockResolvedValue({
          id: "item-1",
          ownerId: "seller-1",
          quantity: 1,
          equippedSlot: null,
          bound: false,
          listings: [],
          auctions: [],
          template: {
            name: "Huyền Thiết",
            category: ItemCategory.MATERIAL,
            tradeable: true,
            bindRules: { auctionEligible: true, auctionClass: "STANDARD" }
          }
        })
      },
      auction: { create: vi.fn().mockResolvedValue(created) },
      gameLog: { create: vi.fn() },
      worldNews: { create: vi.fn() }
    };
    const db: any = { $transaction: vi.fn((fn) => fn(tx)) };

    await expect(createAuction(db, "seller-1", "item-1", 100000n, now)).resolves.toBe(created);
    expect(tx.auction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currentPrice: 0n,
        currentBid: 0n,
        currentRound: -1,
        registrationEndsAt: new Date(now.getTime() + AUCTION_REGISTRATION_MS),
        endsAt: new Date(now.getTime() + AUCTION_REGISTRATION_MS + AUCTION_LIVE_MS)
      })
    });
  });

  it("stores auction registration without creating an opening bid or escrow", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const participant = { id: "participant-1" };
    const tx: any = {
      auction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "auction-1",
          sellerId: "seller-1",
          status: AuctionStatus.ACTIVE,
          phase: AuctionPhase.OPEN_REGISTRATION,
          startingPrice: 100000n,
          registrationEndsAt: new Date(now.getTime() + 1000),
          participants: [],
          item: { template: { name: "Tru Tà Kiếm" } }
        }),
        update: vi.fn()
      },
      auctionBid: { create: vi.fn() },
      auctionParticipant: { create: vi.fn().mockResolvedValue(participant) },
      gameLog: { create: vi.fn() }
    };
    const db: any = { $transaction: vi.fn((fn) => fn(tx)) };

    await expect(joinAuction(db, "buyer-1", "auction-1", "join-key", now)).resolves.toBe(participant);
    expect(tx.auctionParticipant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ lastBidPrice: 0n, lastBidRound: null })
    });
    expect(tx.auctionBid.create).not.toHaveBeenCalled();
    expect(tx.auction.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate, seller, and late registrations server-side", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const baseAuction = {
      id: "auction-1",
      sellerId: "seller-1",
      status: AuctionStatus.ACTIVE,
      phase: AuctionPhase.OPEN_REGISTRATION,
      registrationEndsAt: new Date(now.getTime() + 1000),
      participants: [],
      item: { template: { name: "Tru Tà Kiếm" } }
    };
    const dbFor = (auction: any) => ({
      $transaction: vi.fn((fn) => fn({
        auction: { findUnique: vi.fn().mockResolvedValue(auction) },
        auctionParticipant: { create: vi.fn() },
        gameLog: { create: vi.fn() }
      }))
    });

    await expect(joinAuction(dbFor({ ...baseAuction, participants: [{ characterId: "buyer-1", status: "ACTIVE" }] }) as any, "buyer-1", "auction-1", "dup", now)).rejects.toThrow("đã đăng ký");
    await expect(joinAuction(dbFor(baseAuction) as any, "seller-1", "auction-1", "self", now)).rejects.toThrow("Người bán");
    await expect(joinAuction(dbFor({ ...baseAuction, registrationEndsAt: now }) as any, "buyer-1", "auction-1", "late", now)).rejects.toThrow("đã bắt đầu");
  });

  it("locks bidding after the live window ends", async () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const tx: any = {
      auction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "auction-1",
          sellerId: "seller-1",
          status: AuctionStatus.ACTIVE,
          phase: AuctionPhase.LIVE,
          endsAt: now,
          currentTurnParticipantId: "participant-1",
          currentRound: -1,
          participants: [{ id: "participant-1", characterId: "buyer-1", status: "ACTIVE", lastBidPrice: 0n }],
          item: { template: { name: "Tru Tà Kiếm" } }
        })
      }
    };
    const db: any = { $transaction: vi.fn((fn) => fn(tx)) };

    await expect(raiseAuction(db, "buyer-1", "auction-1", "raise", now)).rejects.toThrow("đã kết thúc");
  });
});
