FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config + all package.json files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/research/package.json packages/research/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY packages/auth/package.json packages/auth/
COPY packages/export/package.json packages/export/

# Install all deps
RUN pnpm install --frozen-lockfile --filter @ancstra/worker...

# Copy source
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/worker/ apps/worker/

WORKDIR /app/apps/worker
EXPOSE 3001
ENV NODE_ENV=production

# Use pnpm exec to find tsx correctly in the hoisted tree
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
