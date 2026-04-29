import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { signUpSchema } from '@/lib/validation';

export const accountRouter = createTRPCRouter({
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.centralDb
        .select({ id: centralSchema.users.id })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.email, input.email))
        .all();

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      await ctx.centralDb
        .insert(centralSchema.users)
        .values({ name: input.name, email: input.email, passwordHash })
        .run();

      return { email: input.email };
    }),
});
