import { describe, expect, it } from "vitest";
import { addItemToInventory, removeItemFromInventory } from "../src/inventory.js";

function fakeInventoryTx(template: { id: string; stackable: boolean; maxStack: number }) {
  let next = 1;
  const items: any[] = [];
  return {
    items,
    tx: {
      itemTemplate: {
        findUniqueOrThrow: async () => template
      },
      itemInstance: {
        findMany: async ({ where }: any) => items.filter((item) => item.ownerId === where.ownerId && item.templateId === where.templateId && item.equippedSlot === null),
        create: async ({ data }: any) => {
          const row = { id: `item_${next++}`, equippedSlot: null, durability: null, ...data, listings: [] };
          items.push(row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = items.find((item) => item.id === where.id);
          if (data.quantity?.increment) row.quantity += data.quantity.increment;
          if (data.quantity?.decrement) row.quantity -= data.quantity.decrement;
          return row;
        },
        findUnique: async ({ where }: any) => {
          const row = items.find((item) => item.id === where.id);
          return row ? { ...row, template, listings: row.listings ?? [] } : null;
        },
        delete: async ({ where }: any) => {
          const index = items.findIndex((item) => item.id === where.id);
          return items.splice(index, 1)[0];
        }
      }
    }
  };
}

describe("inventory helpers", () => {
  it("adds stackable items up to max stack and creates overflow stacks", async () => {
    const fake = fakeInventoryTx({ id: "tpl_1", stackable: true, maxStack: 5 });
    await addItemToInventory(fake.tx as never, "char_1", "tpl_1", 3);
    await addItemToInventory(fake.tx as never, "char_1", "tpl_1", 4);

    expect(fake.items.map((item) => item.quantity)).toEqual([5, 2]);
  });

  it("creates separate instances for non-stackable items", async () => {
    const fake = fakeInventoryTx({ id: "tpl_1", stackable: false, maxStack: 1 });
    await addItemToInventory(fake.tx as never, "char_1", "tpl_1", 2);

    expect(fake.items).toHaveLength(2);
    expect(fake.items.every((item) => item.quantity === 1)).toBe(true);
  });

  it("removes partial and full stacks from inventory", async () => {
    const fake = fakeInventoryTx({ id: "tpl_1", stackable: true, maxStack: 99 });
    const item = await addItemToInventory(fake.tx as never, "char_1", "tpl_1", 5);
    await removeItemFromInventory(fake.tx as never, "char_1", item.id, 2);
    expect(fake.items[0].quantity).toBe(3);

    await removeItemFromInventory(fake.tx as never, "char_1", item.id, 3);
    expect(fake.items).toHaveLength(0);
  });
});
