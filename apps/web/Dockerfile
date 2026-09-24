FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/game/package.json packages/game/package.json
RUN pnpm install --frozen-lockfile=false

FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate && pnpm --filter @ttg/db build && pnpm --filter @ttg/game build && pnpm --filter @ttg/web build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@ttg/web", "start"]
