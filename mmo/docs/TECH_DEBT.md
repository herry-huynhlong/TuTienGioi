# Technical Debt

This file tracks known issues that should not be silently rewritten during unrelated work.

# High Priority

1. Reward double-claim race risk

   `claimCultivation()` and `claimExploration()` check status and then update status inside a transaction. This is better than client-side logic, but it should use a conditional atomic update or equivalent guard so two concurrent requests cannot both pass the status check.

   Required fix:
   - Add regression tests for concurrent/double claim.
   - Use conditional update where `status = ACTIVE` and verify affected row count, or introduce a unique claim ledger/settlement record.

2. Market listing lacks item escrow

   `MarketListing` references an `ItemInstance`, but listing does not clearly lock or transfer item ownership/state. A seller could later equip/transfer/destroy the same item once those flows exist.

   Required fix:
   - Add explicit item state/location or escrow owner.
   - Listing create/cancel/buy must be transactional.

3. Auction settlement incomplete

   Worker currently marks expired auctions as `SETTLED` and writes news, but does not perform escrow payout, item transfer, loser refund, or idempotent settlement.

   Required fix:
   - Implement auction bid escrow and settlement service.
   - Worker should call idempotent settlement service.

# Medium Priority

1. Travel encounters are still shallow

   `Travel` now rolls basic route encounters and persists the result, but outcomes are intentionally lightweight. It does not yet resolve ambush, caravan incidents, weather modifiers, route event modifiers, or multi-step travel interruptions.

2. Legacy zone location still exists

   Travel claim updates both `Character.currentLocationId` and legacy `Character.locationId`. Existing exploration/PvE still starts from zone. Gradually move gameplay to `Location` where appropriate.

3. Magic numbers in services

   Examples:
   - cultivation durations and cost formula;
   - exploration resource weights;
   - market tax `500n / 10000n`;
   - combat reward values;
   - sect creation cost.

   Move balance constants into typed config or `GameConfig` accessors.

4. Randomness is inconsistent

   Combat supports seeded RNG, but `attemptBreakthrough()` defaults to `Math.random()` and registration uses `Math.random()` for root selection.

   Important random outcomes should use an injectable RNG abstraction.

5. Admin functionality is read-only

   Admin dashboard has no action services yet. Future admin actions must enforce authorization and write audit logs.

6. Health endpoint only checks database directly

   Redis is reported as configured/missing but not pinged. Worker health is not checked.

7. Wallet coverage is not yet complete system-wide

   Current source flows no longer directly increment/decrement Linh Thach, and wallet helper tests cover ledger rows, negative-balance rejection, and idempotency keys. Future economy work still needs broader audit coverage for taxes, escrow, marketplace listing creation/cancel, auction settlement, admin grants, donations, and crafting fees.

8. Build logs Prisma errors when `DATABASE_URL` is missing

   `pnpm build` exits successfully, but Next static generation still logs Prisma errors from database-backed pages when no `DATABASE_URL` is configured. Either make those pages fully dynamic without build-time queries or add consistent no-database fallbacks for all public prerender paths.

# Low Priority

1. Shell navigation includes disabled placeholders

   The game shell shows several disabled module entries such as bí cảnh, đấu giá, nghề nghiệp, bạn bè, tin nhắn, chat, nhật ký, and cài đặt. They are intentionally labeled as future modules and should not be treated as completed systems until real services/UI are implemented.

   Required fix:
   - Replace each disabled entry with a real route only when its backend behavior and validation exist.
   - Avoid adding cosmetic-only pages that imply a feature is complete.

2. Package set is incomplete relative to desired foundation

   Product foundation mentions `packages/ui`, `packages/config`, and `packages/types`; current repo does not have them. Add only when a real shared need emerges.

3. Generated artifacts exist in working tree

   Local generated folders/files such as `.next`, `dist`, and `tsconfig.tsbuildinfo` may exist after verification. `.gitignore`/`.dockerignore` already exclude most of them, but a future git initialization should confirm they are not committed.

4. `mmo.txt` is absent from repository

   Product vision currently comes from pasted prompts/attachments. Add `mmo.txt` when the canonical product specification should live in the repo.
