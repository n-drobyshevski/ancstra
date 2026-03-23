FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install all dependencies (including dev for tsx)
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/research/package.json packages/research/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY packages/auth/package.json packages/auth/
COPY packages/export/package.json packages/export/
RUN pnpm install --frozen-lockfile --filter @ancstra/worker...

# Run — use tsx to execute TypeScript directly (no build step)
FROM base AS run
COPY --from=deps /app/ ./
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/worker/ apps/worker/

WORKDIR /app/apps/worker
EXPOSE 3001
ENV NODE_ENV=production
CMD ["/app/node_modules/.bin/tsx", "src/index.ts"]
