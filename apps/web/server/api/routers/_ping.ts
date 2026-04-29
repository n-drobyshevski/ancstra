import { createTRPCRouter, protectedProcedure } from '../trpc';

export const pingRouter = createTRPCRouter({
  membersManage: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),
});
