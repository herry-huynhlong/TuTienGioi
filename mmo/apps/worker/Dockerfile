FROM node:24-alpine AS runner
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm db:generate
CMD ["pnpm", "--filter", "@ttg/worker", "start"]
