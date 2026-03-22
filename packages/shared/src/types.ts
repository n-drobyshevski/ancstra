// Assembled person type (what GET /api/persons/[id] returns)
export interface Person {
  id: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  privacyLevel: 'public' | 'private' | 'restricted';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Assembled from person_names (primary name)
  givenName: string;
  surname: string;
  prefix?: string | null;
  suffix?: string | null;
  // Assembled from events
  birthDate?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
}

// Input for creating a person
export interface CreatePersonInput {
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isLiving: boolean;
  notes?: string;
}

// Person in a list (lighter than full Person)
export interface PersonListItem {
  id: string;
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  birthDate?: string | null;
  deathDate?: string | null;
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
