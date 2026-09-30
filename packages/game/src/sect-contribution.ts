import { Prisma, type PrismaClient } from "@ttg/db";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export class SectContributionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function changeSectContribution(
  tx: Db,
  input: {
    sectId: string;
    characterId: string;
    delta: number;
    sourceType: string;
    reason: string;
    sourceId?: string | null;
    idempotencyKey?: string | null;
  }
) {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new SectContributionError("INVALID_CONTRIBUTION", "Điểm cống hiến không hợp lệ.");
  if (input.idempotencyKey) {
    const existing = await tx.sectContributionTransaction.findUnique({
      where: { characterId_idempotencyKey: { characterId: input.characterId, idempotencyKey: input.idempotencyKey } }
    });
    if (existing) return existing;
  }
  const member = await tx.sectMember.findUnique({ where: { characterId: input.characterId } });
  if (!member || member.sectId !== input.sectId) throw new SectContributionError("NOT_IN_SECT", "Bạn không thuộc tông môn này.");
  const before = member.contribution;
  const after = before + input.delta;
  if (after < 0) throw new SectContributionError("INSUFFICIENT_CONTRIBUTION", "Không đủ điểm cống hiến.");
  await tx.sectMember.update({
    where: { id: member.id },
    data: input.delta > 0 ? { contribution: after, weeklyContribution: { increment: input.delta } } : { contribution: after }
  });
  const ledger = await tx.sectContributionTransaction.create({
    data: {
      sectId: input.sectId,
      characterId: input.characterId,
      amount: input.delta,
      before,
      after,
      type: input.sourceType,
      reason: input.reason,
      referenceType: input.sourceType,
      referenceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey ?? null
    }
  });
  const maybeGameLog = (tx as unknown as { gameLog?: { create(args: { data: { characterId: string; type: string; message: string; metadata: Prisma.InputJsonValue } }): Promise<unknown> } }).gameLog;
  await maybeGameLog?.create({
    data: {
      characterId: input.characterId,
      type: "sect_contribution",
      message: `SECT_CONTRIBUTION_CHANGED ${input.delta > 0 ? "+" : ""}${input.delta}: ${input.reason}`,
      metadata: { sectId: input.sectId, delta: input.delta, balanceAfter: after, sourceType: input.sourceType, sourceId: input.sourceId ?? null } as Prisma.InputJsonValue
    }
  });
  return ledger;
}
