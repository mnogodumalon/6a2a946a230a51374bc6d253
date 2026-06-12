import type { Reparaturauftraege } from './app';

export type EnrichedReparaturauftraege = Reparaturauftraege & {
  kundeName: string;
};
