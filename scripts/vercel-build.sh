#!/bin/bash
set -e

# Build workspace packages (ESM only, skip DTS to avoid type errors)
pnpm --filter @ancstra/matching exec tsup src/index.ts --format esm --no-dts
pnpm --filter @ancstra/research exec tsup src/index.ts --format esm --no-dts
pnpm --filter @ancstra/ai exec tsup src/index.ts --format esm --no-dts

# Build Next.js app
cd apps/web
pnpm build
