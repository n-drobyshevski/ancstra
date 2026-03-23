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
COPY --from=deps /app/ ./
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/worker/ apps/worker/
WORKDIR /app/apps/worker
RUN pnpm build
# Use pnpm deploy to create a self-contained output with all deps
RUN pnpm deploy --filter @ancstra/worker --prod /app/deployed

# Run
FROM node:20-slim AS run
WORKDIR /app
COPY --from=build /app/deployed ./
COPY --from=build /app/apps/worker/dist ./dist

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
