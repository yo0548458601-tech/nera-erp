import { type AddressProvider, type AddressProviderResult, type LocalitySuggestion, type StreetSuggestion } from '@nera/entity-engine';
import { ISRAEL_ADDRESS_SNAPSHOT_DATE, ISRAEL_ADDRESS_SNAPSHOT_SOURCE, israelLocalitiesSnapshot, israelStreetsSnapshot } from './israelAddressSnapshot';

/**
 * The primary AddressProvider for Nera ERP: Israeli localities and
 * streets, backed by israelAddressSnapshot.ts (see that file's docstring
 * for the exact source/date caveats - this is a development snapshot, not
 * a live-synchronized copy of an official dataset yet). Implements the
 * same AddressProvider interface as demoAddressProvider - either can be
 * swapped for the other, or for a future Google Places or server-side
 * proxy provider, without any change to Entity Engine or to how addresses
 * are stored (see addressProvider.ts).
 *
 * Dataset loading, normalization and refresh belong here (the integration
 * layer), never in Entity Engine - this file, not the engine, is where a
 * future real sync job's output would be consumed.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

const localitySearchCache = new Map<string, AddressProviderResult<LocalitySuggestion>>();
const streetSearchCache = new Map<string, AddressProviderResult<StreetSuggestion>>();

async function delayed<T>(value: T): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), 120));
}

export const israelGovernmentAddressProvider: AddressProvider = {
  id: 'israel-government-snapshot',
  label: 'כתובות ישראל (תמונת פיתוח)',

  async searchLocalities(query: string): Promise<AddressProviderResult<LocalitySuggestion>> {
    const normalizedQuery = normalize(query);
    const cacheKey = normalizedQuery;
    const cached = localitySearchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const results = normalizedQuery
        ? israelLocalitiesSnapshot.filter((locality) => normalize(locality.name).includes(normalizedQuery))
        : israelLocalitiesSnapshot;
      const result: AddressProviderResult<LocalitySuggestion> = { results, source: 'government', verified: true };
      localitySearchCache.set(cacheKey, result);
      return await delayed(result);
    } catch {
      return { results: [], source: 'government', verified: false, unavailable: true };
    }
  },

  async searchStreets(localityId: string, query: string): Promise<AddressProviderResult<StreetSuggestion>> {
    const normalizedQuery = normalize(query);
    const cacheKey = `${localityId}::${normalizedQuery}`;
    const cached = streetSearchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const results = israelStreetsSnapshot.filter(
        (street) => street.localityId === localityId && (!normalizedQuery || normalize(street.name).includes(normalizedQuery)),
      );
      const result: AddressProviderResult<StreetSuggestion> = { results, source: 'government', verified: true };
      streetSearchCache.set(cacheKey, result);
      return await delayed(result);
    } catch {
      return { results: [], source: 'government', verified: false, unavailable: true };
    }
  },

  async resolvePostalCode(): Promise<string | undefined> {
    // Postal codes are not part of this development snapshot yet - a real sync job would populate them.
    return undefined;
  },

  async validateAddress(address) {
    const issues: string[] = [];
    if (!address.city) {
      issues.push('לא נבחרה עיר/יישוב.');
    }
    return { valid: issues.length === 0, issues };
  },

  formatAddress(address) {
    const streetLine = [address.street, address.houseNumber].filter(Boolean).join(' ');
    const unitParts = [
      address.entrance ? `כניסה ${address.entrance}` : undefined,
      address.floor ? `קומה ${address.floor}` : undefined,
      address.apartment ? `דירה ${address.apartment}` : undefined,
    ].filter(Boolean);
    return [streetLine, unitParts.join(', '), address.city, address.postalCode, address.country].filter(Boolean).join(', ');
  },

  getProviderInfo() {
    return {
      providerId: 'israel-government-snapshot',
      label: 'כתובות ישראל (תמונת פיתוח)',
      datasetSource: ISRAEL_ADDRESS_SNAPSHOT_SOURCE,
      snapshotDate: ISRAEL_ADDRESS_SNAPSHOT_DATE,
      syncStatus: 'snapshot',
    };
  },
};
