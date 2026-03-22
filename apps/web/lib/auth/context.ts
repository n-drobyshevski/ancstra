/**
 * Auth context resolution — reads proxy headers to determine
 * the current user's family, role, and database file.
 *
 * Stub: returns null until the real implementation lands (Task 13).
 */

export interface AuthContext {
  userId: string;
  familyId: string;
  role: string;
  dbFilename: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  // TODO: Task 13 will implement the real header-reading logic.
  return null;
}
