import 'next-auth';
import 'next-auth/jwt';

export interface FamilyMembership {
  familyId: string;
  role: string;
  dbFilename: string;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      memberships?: FamilyMembership[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    memberships?: FamilyMembership[];
  }
}
