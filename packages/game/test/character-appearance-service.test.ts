import { describe, expect, it, vi } from "vitest";
import { CharacterAppearanceError, setCharacterAppearance } from "../src/character-appearance-service.js";

function dbWithTx(tx: unknown) {
  return {
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    character: { findUniqueOrThrow: vi.fn() }
  } as any;
}

function baseTx(overrides: Record<string, unknown> = {}) {
  return {
    characterAppearanceChange: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    character: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "char-1", name: "A", appearanceKey: "male-01", appearanceChosenAt: null, appearanceChangeCount: 0, avatar: null }),
      update: vi.fn().mockResolvedValue({ id: "char-1", appearanceKey: "female-01", appearanceChosenAt: new Date(), appearanceChangeCount: 0, avatar: "/characters/default/female-01.webp" })
    },
    itemInstance: { findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    gameLog: { create: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    ...overrides
  };
}

describe("character appearance service", () => {
  it("lets the first appearance confirmation update without consuming Dịch Dung Phù", async () => {
    const tx = baseTx();
    const db = dbWithTx(tx);
    await expect(setCharacterAppearance(db, "char-1", "female-01", "first-key")).resolves.toMatchObject({ appearanceKey: "female-01" });
    expect(tx.itemInstance.findFirst).not.toHaveBeenCalled();
    expect(tx.character.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ appearanceKey: "female-01", avatar: "/characters/default/female-01.webp", appearanceChangeCount: { increment: 0 } })
    }));
    expect(tx.characterAppearanceChange.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: "FIRST_FREE", consumedItemId: null }) }));
  });

  it("requires and consumes one Dịch Dung Phù after the first selection", async () => {
    const tx = baseTx();
    tx.character.findUniqueOrThrow.mockResolvedValueOnce({ id: "char-1", name: "A", appearanceKey: "male-01", appearanceChosenAt: new Date("2026-01-01"), appearanceChangeCount: 0, avatar: null });
    tx.itemInstance.findFirst.mockResolvedValue({ id: "item-1", quantity: 1, template: { key: "dich-dung-phu" } });
    tx.itemInstance.updateMany.mockResolvedValue({ count: 1 });
    const db = dbWithTx(tx);
    await setCharacterAppearance(db, "char-1", "female-01", "paid-key");
    expect(tx.itemInstance.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ template: { key: "dich-dung-phu" } }) }));
    expect(tx.itemInstance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "item-1", quantity: { gte: 1 } }), data: { quantity: { decrement: 1 } } }));
    expect(tx.character.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ appearanceChangeCount: { increment: 1 } }) }));
    expect(tx.notification.create).toHaveBeenCalled();
  });

  it("rejects paid changes when the character has no Dịch Dung Phù", async () => {
    const tx = baseTx();
    tx.character.findUniqueOrThrow.mockResolvedValueOnce({ id: "char-1", name: "A", appearanceKey: "male-01", appearanceChosenAt: new Date("2026-01-01"), appearanceChangeCount: 0, avatar: null });
    tx.itemInstance.findFirst.mockResolvedValue(null);
    const db = dbWithTx(tx);
    await expect(setCharacterAppearance(db, "char-1", "female-01", "missing-item")).rejects.toMatchObject({ code: "MISSING_APPEARANCE_ITEM" });
    expect(tx.character.update).not.toHaveBeenCalled();
  });

  it("does not consume for invalid keys or the same current appearance", async () => {
    const tx = baseTx();
    const db = dbWithTx(tx);
    await expect(setCharacterAppearance(db, "char-1", "https://example.com/a.png", "bad")).rejects.toBeInstanceOf(CharacterAppearanceError);
    expect(db.$transaction).not.toHaveBeenCalled();

    tx.character.findUniqueOrThrow.mockResolvedValueOnce({ id: "char-1", name: "A", appearanceKey: "male-01", appearanceChosenAt: new Date("2026-01-01"), appearanceChangeCount: 0, avatar: null });
    await expect(setCharacterAppearance(db, "char-1", "male-01", "same")).rejects.toMatchObject({ code: "SAME_APPEARANCE" });
    expect(tx.itemInstance.updateMany).not.toHaveBeenCalled();
  });

  it("treats duplicate action keys as idempotent", async () => {
    const tx = baseTx();
    tx.characterAppearanceChange.findUnique.mockResolvedValue({ id: "change-1" });
    tx.character.findUniqueOrThrow.mockResolvedValue({ id: "char-1", appearanceKey: "female-01", avatar: "/characters/default/female-01.webp" });
    const db = dbWithTx(tx);
    await expect(setCharacterAppearance(db, "char-1", "female-01", "repeat")).resolves.toMatchObject({ appearanceKey: "female-01" });
    expect(tx.itemInstance.updateMany).not.toHaveBeenCalled();
    expect(tx.character.update).not.toHaveBeenCalled();
  });
});
