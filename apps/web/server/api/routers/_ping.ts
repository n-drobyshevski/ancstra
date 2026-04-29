import { createTRPCRouter, protectedProcedure } from '../trpc';

export const pingRouter = createTRPCRouter({
  treeView: protectedProcedure
    .meta({ permission: 'tree:view' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),

  membersManage: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),
});
