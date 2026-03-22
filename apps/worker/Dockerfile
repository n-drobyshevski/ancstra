FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install dependencies
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

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/ ./packages/
COPY tsconfig.json ./
COPY apps/worker/ apps/worker/
WORKDIR /app/apps/worker
RUN pnpm build

# Run
FROM node:20-slim AS run
WORKDIR /app
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/apps/worker/node_modules ./node_modules
COPY --from=build /app/apps/worker/package.json ./

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
