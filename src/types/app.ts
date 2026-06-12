// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Reparaturauftraege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftragsnummer?: string;
    eingangsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    fahrzeug_bezeichnung?: string;
    kennzeichen?: string;
    problembeschreibung?: string;
    mitarbeiter?: string;
    voraussichtliche_fertigstellung?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    interne_notizen?: string;
  };
}

export interface Kundenverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    telefon?: string;
    email?: string;
    notiz_kunde?: string;
  };
}

export const APP_IDS = {
  REPARATURAUFTRAEGE: '6a2a945752aca730d81808a1',
  KUNDENVERWALTUNG: '6a2a94549cc8953c0fbcc8bc',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'reparaturauftraege': {
    status: [{ key: "eingegangen", label: "Eingegangen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "fertig_zur_abholung", label: "Fertig zur Abholung" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'reparaturauftraege': {
    'auftragsnummer': 'string/text',
    'eingangsdatum': 'date/date',
    'kunde': 'applookup/select',
    'fahrzeug_bezeichnung': 'string/text',
    'kennzeichen': 'string/text',
    'problembeschreibung': 'string/textarea',
    'mitarbeiter': 'string/text',
    'voraussichtliche_fertigstellung': 'date/date',
    'status': 'lookup/radio',
    'interne_notizen': 'string/textarea',
  },
  'kundenverwaltung': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'notiz_kunde': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateReparaturauftraege = StripLookup<Reparaturauftraege['fields']>;
export type CreateKundenverwaltung = StripLookup<Kundenverwaltung['fields']>;