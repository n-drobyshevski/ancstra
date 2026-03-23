FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN npm install -g tsx

WORKDIR /app

# Copy everything needed for install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/research/package.json packages/research/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY packages/auth/package.json packages/auth/
COPY packages/export/package.json packages/export/

# Full install (not filtered) so all deps are available
# Use hoisted node_modules layout so tsx can resolve packages
RUN echo "node-linker=hoisted" > .npmrc && echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install

# Copy source
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/worker/ apps/worker/

WORKDIR /app/apps/worker
EXPOSE 3001
ENV NODE_ENV=production
# Use pnpm exec to resolve deps through pnpm's store, with global tsx
CMD ["sh", "-c", "NODE_PATH=$(pnpm root) tsx src/index.ts"]
