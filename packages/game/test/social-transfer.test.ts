import { describe, expect, it } from "vitest";
import { AssetTransferType, Currency } from "@ttg/db";
import { sendFriendCurrency, SocialError } from "../src/social.js";

function fakeSocialDb() {
  const characters = new Map([
    ["sender", { id: "sender", linhThach: 500n, tienNgoc: 0n }],
    ["receiver", { id: "receiver", linhThach: 20n, tienNgoc: 0n }],
    ["blocked", { id: "blocked", linhThach: 0n, tienNgoc: 0n }]
  ]);
  const walletTransactions = new Map<string, unknown>();
  const transfers = new Map<string, { id: string; senderId: string; receiverId: string; type: AssetTransferType; currency: Currency; amount: bigint; idempotencyKey: string }>();
  const notifications: Array<{ characterId: string; title: string; body: string }> = [];
  const messages: Array<{ senderId: string; receiverId: string; body: string }> = [];
  const friendships = new Set(["receiver:sender"]);
  const blocks = new Set(["sender:blocked"]);

  const tx = {
    blockedPlayer: {
      findFirst: async ({ where }: { where: { OR: Array<{ blockerId: string; blockedId: string }> } }) => where.OR.some((row) => blocks.has(`${row.blockerId}:${row.blockedId}`)) ? { id: "block" } : null
    },
    friendship: {
      findUnique: async ({ where }: { where: { memberAId_memberBId: { memberAId: string; memberBId: string } } }) => friendships.has(`${where.memberAId_memberBId.memberAId}:${where.memberAId_memberBId.memberBId}`) ? { id: "friend" } : null
    },
    assetTransfer: {
      findUnique: async ({ where }: { where: { senderId_idempotencyKey: { senderId: string; idempotencyKey: string } } }) => transfers.get(`${where.senderId_idempotencyKey.senderId}:${where.senderId_idempotencyKey.idempotencyKey}`) ?? null,
      create: async ({ data }: { data: { senderId: string; receiverId: string; type: AssetTransferType; currency: Currency; amount: bigint; idempotencyKey: string } }) => {
        const transfer = { id: `transfer_${transfers.size + 1}`, ...data };
        transfers.set(`${data.senderId}:${data.idempotencyKey}`, transfer);
        return transfer;
      }
    },
    character: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const character = characters.get(where.id);
        if (!character) throw new Error("missing character");
        return character;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<{ linhThach: bigint; tienNgoc: bigint }> }) => {
        const character = characters.get(where.id);
        if (!character) throw new Error("missing character");
        Object.assign(character, data);
        return character;
      }
    },
    walletTransaction: {
      findUnique: async ({ where }: { where: { characterId_currency_idempotencyKey: { characterId: string; currency: Currency; idempotencyKey: string } } }) => {
        const unique = where.characterId_currency_idempotencyKey;
        return walletTransactions.get(`${unique.characterId}:${unique.currency}:${unique.idempotencyKey}`) ?? null;
      },
      create: async ({ data }: { data: { characterId: string; currency: Currency; idempotencyKey: string | null } }) => {
        if (data.idempotencyKey) walletTransactions.set(`${data.characterId}:${data.currency}:${data.idempotencyKey}`, data);
        return data;
      }
    },
    conversation: {
      upsert: async () => ({ id: "conversation" }),
      update: async () => ({ id: "conversation" })
    },
    message: {
      create: async ({ data }: { data: { senderId: string; receiverId: string; body: string } }) => {
        messages.push(data);
        return { id: `message_${messages.length}`, createdAt: new Date("2026-01-01T00:00:00.000Z"), ...data };
      }
    },
    playerSettings: {
      upsert: async ({ where }: { where: { characterId: string } }) => ({ characterId: where.characterId, transferNotifications: true })
    },
    notification: {
      create: async ({ data }: { data: { characterId: string; title: string; body: string } }) => {
        notifications.push(data);
        return { id: `notification_${notifications.length}`, createdAt: new Date(), readAt: null, ...data };
      }
    }
  };

  return {
    characters,
    transfers,
    notifications,
    messages,
    db: {
      $transaction: async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx)
    }
  };
}

describe("social asset transfer", () => {
  it("moves currency, writes one transfer notification, and keeps retries idempotent", async () => {
    const fake = fakeSocialDb();

    const first = await sendFriendCurrency(fake.db as never, "sender", "receiver", 75n, "same-click");
    const retry = await sendFriendCurrency(fake.db as never, "sender", "receiver", 75n, "same-click");

    expect(retry.id).toBe(first.id);
    expect(fake.characters.get("sender")?.linhThach).toBe(425n);
    expect(fake.characters.get("receiver")?.linhThach).toBe(95n);
    expect(fake.transfers.size).toBe(1);
    expect(fake.messages).toHaveLength(1);
    expect(fake.notifications).toMatchObject([{ characterId: "receiver", title: "Nhận Linh Thạch" }]);
  });

  it("blocks asset transfer when either player has blocked the other", async () => {
    const fake = fakeSocialDb();

    await expect(sendFriendCurrency(fake.db as never, "sender", "blocked", 10n, "blocked-click")).rejects.toBeInstanceOf(SocialError);
    expect(fake.transfers.size).toBe(0);
    expect(fake.notifications).toHaveLength(0);
  });
});
