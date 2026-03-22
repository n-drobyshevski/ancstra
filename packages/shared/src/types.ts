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

export interface Family {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  relationshipType: 'married' | 'civil_union' | 'domestic_partner' | 'unmarried' | 'unknown';
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
  partner1?: PersonListItem | null;
  partner2?: PersonListItem | null;
  children?: PersonListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  eventType: string;
  dateOriginal: string | null;
  dateSort: number | null;
  dateModifier: 'exact' | 'about' | 'estimated' | 'before' | 'after' | 'between' | 'calculated' | 'interpreted' | null;
  dateEndSort: number | null;
  placeText: string | null;
  description: string | null;
  personId: string | null;
  familyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePersonInput {
  givenName?: string;
  surname?: string;
  sex?: 'M' | 'F' | 'U';
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isLiving?: boolean;
  notes?: string;
}

export interface CreateFamilyInput {
  partner1Id?: string;
  partner2Id?: string;
  relationshipType?: Family['relationshipType'];
}

export interface CreateEventInput {
  eventType: string;
  dateOriginal?: string;
  dateEndOriginal?: string;
  placeText?: string;
  description?: string;
  dateModifier?: Event['dateModifier'];
  personId?: string;
  familyId?: string;
}

export interface UpdateEventInput {
  eventType?: string;
  dateOriginal?: string;
  dateEndOriginal?: string;
  placeText?: string;
  description?: string;
  dateModifier?: Event['dateModifier'];
}

export interface RelationContext {
  relation: 'spouse' | 'father' | 'mother' | 'child';
  ofPersonId: string;
}

export interface PersonDetail extends Person {
  spouses: PersonListItem[];
  parents: PersonListItem[];
  children: PersonListItem[];
  events: Event[];
}

export interface FamilyRecord {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  relationshipType: 'married' | 'civil_union' | 'domestic_partner' | 'unmarried' | 'unknown';
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
}

export interface ChildLink {
  familyId: string;
  personId: string;
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
}

export interface TreeData {
  persons: PersonListItem[];
  families: FamilyRecord[];
  childLinks: ChildLink[];
}

export type SourceType = 'vital_record' | 'census' | 'military' | 'church' | 'newspaper' |
  'immigration' | 'land' | 'probate' | 'cemetery' | 'photograph' |
  'personal_knowledge' | 'correspondence' | 'book' | 'online' | 'other';

export interface Source {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  publicationDate: string | null;
  repositoryName: string | null;
  repositoryUrl: string | null;
  sourceType: SourceType | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  citationCount?: number;
}

export interface Citation {
  id: string;
  sourceId: string;
  source?: Source;
  citationDetail: string | null;
  citationText: string | null;
  confidence: 'high' | 'medium' | 'low' | 'disputed';
  personId: string | null;
  eventId: string | null;
  familyId: string | null;
  personNameId: string | null;
  createdAt: string;
}

export interface CreateSourceInput {
  title: string;
  author?: string;
  publisher?: string;
  publicationDate?: string;
  repositoryName?: string;
  repositoryUrl?: string;
  sourceType?: SourceType;
  notes?: string;
}

export interface CreateCitationInput {
  sourceId: string;
  citationDetail?: string;
  citationText?: string;
  confidence?: Citation['confidence'];
  personId?: string;
  eventId?: string;
  familyId?: string;
  personNameId?: string;
}
