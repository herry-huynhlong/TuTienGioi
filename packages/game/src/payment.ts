import { Currency, PaymentStatus, WalletTxType, type PrismaClient } from "@ttg/db";
import { creditWallet, GameError } from "./services.js";

export async function handlePaymentWebhook(db: PrismaClient, input: { orderCode: string; providerTransactionId: string; amountVnd: number; raw: unknown }) {
  return db.$transaction(async (tx) => {
    const order = await tx.topupOrder.findUnique({ where: { orderCode: input.orderCode } });
    if (!order) throw new GameError("ORDER_NOT_FOUND", "Không tìm thấy đơn nạp.");
    const existing = await tx.paymentTransaction.findUnique({ where: { providerTransactionId: input.providerTransactionId } });
    if (existing) return { status: "duplicate" as const };
    if (order.amountVnd !== input.amountVnd) throw new GameError("AMOUNT_MISMATCH", "Số tiền không khớp.");
    await tx.paymentTransaction.create({ data: { orderId: order.id, provider: order.provider, providerTransactionId: input.providerTransactionId, amountVnd: input.amountVnd, raw: input.raw as never } });
    if (order.status !== PaymentStatus.PAID) {
      await tx.topupOrder.update({ where: { id: order.id }, data: { status: PaymentStatus.PAID, paidAt: new Date() } });
      await creditWallet(tx, order.characterId, Currency.TIEN_NGOC, BigInt(order.rewardTienNgoc), WalletTxType.PAYMENT, "TopupOrder", order.id, `payment:${order.id}`);
    }
    return { status: "credited" as const };
  });
}
