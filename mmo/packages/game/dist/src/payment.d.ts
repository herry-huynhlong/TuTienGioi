import { type PrismaClient } from "@ttg/db";
export declare function handlePaymentWebhook(db: PrismaClient, input: {
    orderCode: string;
    providerTransactionId: string;
    amountVnd: number;
    raw: unknown;
}): Promise<{
    status: "duplicate";
} | {
    status: "credited";
}>;
