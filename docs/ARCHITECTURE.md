# Architecture

This document records the implementation decisions that should be preserved across future sessions. Extend existing boundaries instead of creating parallel systems.

# Module Boundaries

- `apps/web`
  - Owns rendering, route structure, server actions, auth/session integration, and user-facing/admin UI.
  - Must not contain core game calculations such as combat damage, loot rolls, breakthrough rules, wallet mutation rules, or market settlement.
- `apps/worker`
  - Owns global scheduled work only: cache refresh, global events, expiration/settlement jobs, cleanup, and future notifications.
  - Must not create per-player timers.
- `packages/db`
  - Owns Prisma schema, migrations, Prisma client, and seed data.
  - Schema changes must be incremental migrations. Do not edit applied migrations.
- `packages/game`
  - Owns domain rules and server-authoritative services.
  - UI/API layers should pass intentions and identifiers into this package.

# Database Ownership

PostgreSQL is authoritative for persistent state. Prisma models are the schema source. Redis is cache/coordination, not source of truth.

Seed data should be idempotent where possible using stable keys/slugs. Production-like data should not be faked in pages; seed may create content definitions and bootstrap admin.

# Auth Architecture

Auth currently uses:

- `User` with unique `username` and `email`.
- Argon2id password hashing through `apps/web/lib/auth.ts`.
- `Session` rows storing only SHA-256 hashes of random session tokens.
- HTTP-only `ttg_session` cookie.
- `getUser()` rejects expired sessions and non-`ACTIVE` accounts.

Future auth work should extend this with password reset/change-email flows, rate limiting, CSRF strategy, and RBAC helpers.

# Game Logic Location

Core game logic belongs in `packages/game`:

- calculations in `rules.ts`;
- transactional services in `services.ts`;
- payment handling in `payment.ts`;
- RNG helpers in `rng.ts`.

React components and server actions must not calculate rewards, damage, prices, seller identity, item stats, or claim eligibility on their own.

# Game UI Architecture

The authenticated game UI uses `apps/web/components/Shell.tsx` as the shared game chrome. It owns account display, character resource bars, wallet/location summary, grouped navigation, disabled module placeholders, and mobile bottom navigation. Individual `/game/*` pages should focus on their specific content and actions rather than duplicating global status/sidebar UI.

The shell may read already-derived character/account state for display, but it should not become a gameplay service. New player actions should still flow through server actions/API boundaries into `packages/game`.

# Wallet Architecture

Current balances live on `Character.linhThach` and `Character.tienNgoc`. Every important currency mutation should go through:

- `creditWallet()`
- `debitWallet()`

Those helpers write `WalletTransaction` with before/after balances and optional idempotency key.

Known exception to fix: some current actions/services still update character balances directly. Do not add new direct balance mutations.

# Inventory Architecture

Current inventory uses:

- `ItemTemplate` for content definitions.
- `ItemInstance` for owned/stacked/equipped concrete items.

Future inventory work should add explicit ownership/location state for market escrow, auction escrow, storage, equipped state, business orders, contracts, and caravan cargo. Avoid allowing the same item to be listed, equipped, and transferred at the same time.

# Combat Architecture

Current combat is a deterministic-capable turn simulation in `simulateCombat()`, called by `fightMonster()`. Combat records are written to `Combat` with JSON log/reward.

Future combat work should extend the existing engine instead of adding a separate one. Add participants, skills, status effects, loot tables, and battle-log persistence around the existing service boundary.

# World Architecture

Current world implementation now has:

`World -> Region -> Zone -> Location -> Route`

Routes are gameplay entities with travel time, cost, danger, security level, encounter table, ambush allowance, caravan allowance, minimum realm, and modifiers. `Zone` remains for backward compatibility with existing exploration/PvE flows. `Character.locationId` still points to `Zone`; `Character.currentLocationId` is the newer nullable pointer to `Location`.

Travel now uses `Route` as the source of truth. `Travel` snapshots cost, danger, security, and encounter table at start time. Claiming travel updates `Character.currentLocationId` and the legacy `Character.locationId` for backward compatibility. Claiming also resolves one basic encounter from the route snapshot and stores `encounterKey`/`encounterResult`. Future travel work should extend weather/event modifiers, ambush, caravan, and richer encounter consequences without bypassing routes.

# Worker Responsibilities

The worker currently:

- refreshes cultivation leaderboard cache into Redis;
- expires market listings;
- marks expired auctions settled;
- spawns a basic global world event;
- logs structured JSON strings for ticks/errors.

Future worker jobs should remain global/system-level, idempotent, and safe to retry.

# Realtime Architecture

No realtime layer is currently implemented. Future realtime should be limited to chat, notifications, world event notices, and possibly auction updates. Gameplay progress should remain timestamp-based, not realtime tick-based.

# Admin Architecture

Admin UI currently provides read-only summary data. Future admin actions must:

- check `User.role === ADMIN` or a future RBAC helper;
- write `AdminAuditLog`;
- route currency/item grants through domain services and ledger.

# Error Architecture

`GameError` in `packages/game/src/services.ts` has stable error codes and Vietnamese user-facing messages. Future API/server action boundaries should preserve error codes and translate them for UI instead of parsing arbitrary strings.
