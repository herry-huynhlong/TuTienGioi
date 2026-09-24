# Tu Tiên Giới

Tu Tiên Giới là một text-based browser MMORPG/persistent world lấy cảm hứng ở mức mô hình hệ thống từ các game như Torn: tiến trình dài hạn, kinh tế người chơi, faction/tông môn, marketplace, leaderboard, lịch sử thế giới và hành động tính theo thời gian. Lore, giao diện, dữ liệu và code là riêng.

## Kiến trúc

- `apps/web`: Next.js, React, API/server actions, auth, UI game và admin.
- `apps/worker`: job toàn server như leaderboard cache, hết hạn chợ/đấu giá, world event.
- `packages/db`: Prisma schema, client và seed data.
- `packages/game`: service layer server-authoritative cho tu luyện, đột phá, combat, exploration, market, payment ledger.
- PostgreSQL là nguồn sự thật; Redis dùng cho cache/job nhẹ.

## Yêu cầu

- Node.js 24+
- pnpm 11+
- PostgreSQL 17+
- Redis 7+
- Docker Desktop nếu chạy bằng compose

## Cài đặt local

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Mở `http://localhost:3000`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Nếu database mới hoàn toàn, chạy migration/seed trong container web:

```bash
docker compose exec web pnpm db:migrate
docker compose exec web pnpm db:seed
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm worker
```

## ENV

Các biến cần thiết nằm trong `.env.example`: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `APP_URL`, admin bootstrap và payment provider keys. Không commit `.env`.

## Admin bootstrap

Seed tạo admin từ:

- `ADMIN_EMAIL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Nếu không set, môi trường dev dùng fallback `admin@example.com` / `admin123456`.

## Payment

Payment được thiết kế theo abstraction đơn hàng và webhook:

1. Backend tạo `TopupOrder`.
2. Provider trả QR/checkout ở layer tích hợp.
3. Webhook verify signature ở adapter provider.
4. Server kiểm tra amount, `providerTransactionId` unique, idempotent.
5. Tiền được cộng qua `WalletTransaction`.

Không cộng Tiên Ngọc từ return URL hoặc dữ liệu browser gửi.

## Backup PostgreSQL

```bash
pg_dump "$DATABASE_URL" > backup.sql
psql "$DATABASE_URL" < backup.sql
```

Với Docker:

```bash
docker compose exec postgres pg_dump -U tutien tutiengioi > backup.sql
```

## Hệ thống đã có

- Auth username/email/password bằng Argon2id và server session.
- Character, realm/stage config, spiritual root, talents, techniques.
- Cultivation theo `startedAt/endsAt/status`, claim idempotent ở service.
- Breakthrough server-side.
- Exploration, loot item instance, PvE combat turn-based.
- Inventory/equipment schema.
- Marketplace/auction schema và service mua hàng transaction.
- Sect creation, members, buildings.
- World news/history, leaderboard, admin economy dashboard.
- Payment order/transaction/wallet ledger schema và webhook handler.
- Worker jobs, health check, Docker, seed data, tests core rules.

## Mở rộng tiếp

- Travel activity đầy đủ với route claim riêng.
- UI mua/bán market và bid auction.
- Chat realtime bằng Redis pub/sub hoặc websocket gateway.
- Admin CRUD sâu cho content data.
- PvP, sect war windows, world boss contribution.
