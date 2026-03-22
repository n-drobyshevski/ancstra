/**
 * FamilySearch OAuth token response.
 */
export interface FSTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * A person record from the FamilySearch API (GEDCOM-X format).
 */
export interface FSPerson {
  id: string;
  display: {
    name: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    gender?: string;
  };
}

/**
 * FamilySearch search API response shape.
 */
export interface FSSearchResponse {
  entries?: Array<{
    content: {
      gedcomx: {
        persons?: FSPerson[];
      };
    };
    score?: number;
  }>;
  results?: number;
}
