import type { EnrichedReparaturauftraege } from '@/types/enriched';
import type { Kundenverwaltung, Reparaturauftraege } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface ReparaturauftraegeMaps {
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
}

export function enrichReparaturauftraege(
  reparaturauftraege: Reparaturauftraege[],
  maps: ReparaturauftraegeMaps
): EnrichedReparaturauftraege[] {
  return reparaturauftraege.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenverwaltungMap, 'vorname', 'nachname'),
  }));
}
