import { headers } from 'next/headers';
import { createCallerFactory } from '@/server/api/trpc';
import { appRouter } from '@/server/api/routers/_app';
import { createTRPCContext } from '@/server/api/init';

const createCaller = createCallerFactory(appRouter);

export async function trpcServer() {
  const ctx = await createTRPCContext({ headers: await headers() });
  return createCaller(ctx);
}
