export interface GedcomNode {
  tag: string;
  data: string;
  tree: GedcomNode[];
}

export interface GedcomImportData {
  persons: GedcomPerson[];
  names: GedcomName[];
  families: GedcomFamily[];
  childLinks: GedcomChildLink[];
  events: GedcomEvent[];
  warnings: GedcomWarning[];
  stats: GedcomStats;
}

export interface GedcomPerson {
  id: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  notes: string | null;
  xref: string;
}

export interface GedcomName {
  id: string;
  personId: string;
  givenName: string;
  surname: string;
  suffix: string | null;
  prefix: string | null;
  nameType: string;
  isPrimary: boolean;
}

export interface GedcomFamily {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  xref: string;
}

export interface GedcomChildLink {
  familyId: string;
  personId: string;
}

export interface GedcomEvent {
  id: string;
  eventType: string;
  dateOriginal: string | null;
  dateSort: number | null;
  dateModifier: string | null;
  dateEndSort: number | null;
  placeText: string | null;
  personId: string | null;
  familyId: string | null;
}

export interface GedcomWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
  xref?: string;
}

export interface GedcomStats {
  persons: number;
  families: number;
  events: number;
  skippedSources: number;
}

export interface GedcomPreview {
  stats: GedcomStats;
  warnings: GedcomWarning[];
  existingPersonCount: number;
}
