# Current Architecture

Tu Tien Gioi is a pnpm monorepo using a modular-monolith shape:

- `apps/web`: Next.js app with server actions, auth/session helpers, game UI, admin page, and health endpoint.
- `apps/worker`: long-running worker for global jobs such as leaderboard cache, market/auction expiration, and world event spawning.
- `packages/db`: Prisma schema, Prisma client singleton, seed script, and migration history.
- `packages/game`: server-authoritative game rules and services. React components should call these services through server actions/API boundaries instead of recalculating game outcomes.

PostgreSQL is the durable source of truth. Redis is currently used by the worker for leaderboard cache. Time-based player activities use `startedAt`, `endsAt`, and `status`; no per-player timers should be introduced.

# Completed Systems

- Monorepo foundation with `apps/web`, `apps/worker`, `packages/db`, and `packages/game`.
- PostgreSQL/Redis Docker Compose services and `.env.example`.
- Prisma schema and initial migration: `packages/db/prisma/migrations/20260924085251_init`.
- Seed script for realms, realm stages, spiritual roots, talents, zones, item templates, techniques, professions, monsters, config, top-up package, admin account, and initial world news.
- Username/email/password registration and login using Argon2id.
- Server-side sessions using hashed session tokens in `Session`.
- Character creation at registration with realm stage, spiritual root, location, and starting talents.
- Dashboard, character page, world/exploration/PvE page, market list page, sect page, leaderboard, admin summary, landing page, PWA manifest, and health endpoint.
- Cultivation start/claim service with reward snapshot fields.
- Breakthrough service using realm stage requirements and success chance.
- Exploration start/claim service that grants item instances.
- Turn-based PvE combat simulation with seeded RNG support.
- Wallet ledger helpers `creditWallet()` and `debitWallet()`.
- Payment webhook handler with provider transaction idempotency.
- Market purchase service with serializable transaction and tax calculation.
- Worker jobs for leaderboard cache, listing expiration, auction status settlement marker, and global world event creation.
- Basic tests for energy calculation, cultivation reward, and deterministic combat.
- World graph foundation with `World`, `Region`, `Location`, and `Route` models.
- Seeded world hierarchy: 1 world, 5 regions, 9 zones, 12 locations, and 8 initial routes.
- World page renders regions, zones, locations, and outbound routes from database data.
- Route-based `Travel` model and services.
- Travel UI can start an outbound route from the current location and claim arrival after `endsAt`.
- Travel encounter resolution on claim using route encounter snapshots.
- Travel claim persists `encounterKey` and `encounterResult`, applies lightweight outcomes, and writes travel game logs.
- Dense game shell UI with Torn-inspired clarity: left status sidebar, grouped navigation, resource bars, wallet/location summary, notification count, mobile bottom navigation, and disabled placeholders for unfinished modules.

# Partially Completed Systems

- Wallet/economy: wallet ledger exists and current source flows route Linh Thach changes through wallet helpers, but broader escrow/tax/audit coverage is still incomplete.
- Inventory/equipment: schema supports item instances and equipped slot, but equip/unequip/use/destroy services and UI are not implemented.
- Marketplace: purchase service exists, but UI buy/list/cancel flows are incomplete and item escrow/locking is not modeled.
- Auction: schema and worker expiration marker exist, but bid/escrow/settlement services are incomplete.
- Crafting: profession, recipe, and craft job schema exist, but start/claim crafting services and UI are incomplete.
- World: graph foundation exists, but route modifiers are still shallow and only basic encounter keys are resolved.
- Travel: route-based travel and basic encounters exist, but ambush, caravan incidents, weather modifiers, and interrupted travel states are not implemented yet.
- Combat: basic PvE service exists, but combat participant/log tables, skills, status effects, loot tables, and battle-log UI are still shallow.
- Sect: create-sect flow exists, but applications, donations, treasury ledger, permissions, upgrades, logs, diplomacy, wars, and spirit veins are incomplete.
- Social: chat/private message/notification schema exists, but UI/API behavior is minimal or absent.
- Admin/moderation: admin page is a read-only summary; admin actions and audit trail enforcement are not implemented.
- Payment: tables and webhook service exist, but provider abstraction, signature verification adapters, and create-order UI/API are incomplete.
- Observability/security: health endpoint exists, but rate limiting, CSRF strategy, structured logging helpers, security headers, and anti-bot checks are incomplete.

# Current Work Unit

No active work unit after the economy safety pass.

Last completed work units:

- Routed PvE Linh Thach rewards through `creditWallet()`.
- Routed sect creation cost through `debitWallet()`.
- Added wallet service tests for ledger rows, negative-balance rejection, and idempotency keys.

- Reworked the authenticated game shell into a clearer dark MMO layout.
- Added character/account/resource/location data to the shared shell.
- Grouped navigation by overview, cultivation, economy, community, and system modules.
- Marked not-yet-implemented modules as disabled placeholders instead of fake complete pages.

- Added travel encounter resolution from route encounter tables.
- Added migration `20260924120649_travel_encounter_resolution`.
- Travel now records encounter key/result and shows recent travel logs on the world page.

- Added first-class `Travel` model and route-based start/claim services.
- Added migration `20260924115309_route_based_travel`.
- Updated world UI with travel start/claim controls.

- Added world graph foundation with `World`, `Region`, `Location`, and `Route`.
- Added migration `20260924114542_world_graph_foundation`.
- Updated seed data and world UI to show hierarchy and routes.

- Created project memory documentation for incremental development.
- Added `docs/IMPLEMENTATION_STATUS.md`, `docs/ARCHITECTURE.md`, and `docs/TECH_DEBT.md`.
- No database or gameplay code changes were made.

# Database Models

Current Prisma models include:

- Auth/account: `User`, `Session`
- Character/progression: `Character`, `Realm`, `RealmStage`, `SpiritualRoot`, `Talent`, `CharacterTalent`, `Technique`, `CharacterTechnique`
- Items/economy: `ItemTemplate`, `ItemInstance`, `WalletTransaction`, `MarketListing`, `MarketTransaction`, `Auction`, `AuctionBid`
- Activities: `CultivationActivity`, `ExplorationActivity`, `Travel`, `CraftJob`
- Professions/crafting: `Profession`, `CharacterProfession`, `Recipe`
- World/combat: `World`, `Region`, `Zone`, `Location`, `Route`, `Monster`, `Combat`
- Sect/social: `Sect`, `SectMember`, `SectBuilding`, `SectRelation`, `PrivateMessage`, `ChatMessage`, `Notification`
- World state/history: `WorldEvent`, `WorldNews`, `GameLog`, `GameConfig`
- Payment: `TopupPackage`, `TopupOrder`, `PaymentTransaction`
- Moderation/admin: `Report`, `AdminAuditLog`

Important schema gap: route-based `Travel` now exists and resolves basic encounters, but `Character.locationId` still points to legacy `Zone` while `Character.currentLocationId` is the newer nullable location pointer. Travel claim updates both for backward compatibility.

# Important Services

- `packages/game/src/rules.ts`
  - `currentEnergy()`
  - `calculateCultivationReward()`
  - `calculateCharacterStats()`
  - `simulateCombat()`
- `packages/game/src/services.ts`
  - `creditWallet()`
  - `debitWallet()`
  - `startCultivation()`
  - `claimCultivation()`
  - `attemptBreakthrough()`
  - `startExploration()`
  - `claimExploration()`
  - `startTravel()`
  - `claimTravel()`
  - `fightMonster()`
  - `purchaseMarketListing()`
- `packages/game/src/payment.ts`
  - `handlePaymentWebhook()`
- `apps/web/lib/auth.ts`
  - `createSession()`
  - `destroySession()`
  - `getUser()`
  - `requireUser()`
  - `hashPassword()`
  - `verifyPassword()`
- `apps/web/lib/forms.ts`
  - server actions for register/login/logout, cultivation, breakthrough, exploration, PvE, and sect creation.

# Important APIs

- `GET /api/health`: checks web and database connectivity and reports Redis as configured/missing.

Most gameplay interactions currently use Next.js server actions instead of JSON REST routes.

# Known Technical Debt

See `docs/TECH_DEBT.md` for the active list. Highest-priority items are reward double-claim race risk, missing marketplace item escrow, incomplete auction settlement, incomplete route/travel graph, and broader concurrency/idempotency tests.

# Known Bugs

- `claimCultivation()` and `claimExploration()` check status then update inside a transaction, but do not use conditional update or a unique claim record. Concurrent requests may still race depending on database isolation.
- Market listing does not move/lock item ownership into escrow when listed.
- Worker auction expiration only marks auctions as `SETTLED`; it does not transfer item/currency or refund escrow.
- `pnpm build` exits successfully without `DATABASE_URL`, but Next prerender logs Prisma errors from dynamic pages that query database-backed content during static generation.

# Next Work Units

Recommended order:

1. Fix reward double-claim race risk in cultivation/exploration with conditional claim updates and regression tests.
2. Implement inventory/equipment services: equip, unequip, use consumable, destroy item, and server-side derived stat recalculation.
3. Add route weather/event modifiers and richer encounter outcomes.
4. Complete marketplace item escrow/list/cancel/buy UI and tests.
5. Complete crafting start/claim using recipes, inventory consumption, ledger fee, output item, and double-claim protection.
