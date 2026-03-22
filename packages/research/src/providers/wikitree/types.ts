/**
 * WikiTree API response types.
 */

export interface WikiTreePerson {
  Id: number;
  Name: string;
  FirstName?: string;
  LastNameAtBirth?: string;
  LastNameCurrent?: string;
  BirthDate?: string;
  DeathDate?: string;
  BirthLocation?: string;
  DeathLocation?: string;
  IsLiving?: number;
  Gender?: string;
  LongName?: string;
  ShortName?: string;
}

export interface WikiTreeSearchResponse {
  /** Status code from the API, 0 = success */
  status?: number;
  /** Array of person results (may also be keyed by index) */
  searchResults?: WikiTreePerson[];
  /** Some endpoints return results under different keys */
  [key: string]: unknown;
}
