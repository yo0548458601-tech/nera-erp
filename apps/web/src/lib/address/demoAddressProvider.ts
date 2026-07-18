import { type AddressProvider, type AddressProviderResult, type LocalitySuggestion, type StreetSuggestion } from '@nera/entity-engine';

/**
 * A small, clearly-labeled demo/local AddressProvider - NOT an official or
 * verified address registry. Deliberately a short, curated list (not a
 * full national gazetteer bundled into the client) covering a handful of
 * Israeli localities and a few streets each, enough to demonstrate the
 * locality -> street -> details autocomplete flow end to end. A future
 * trusted provider (a government registry, a paid geocoding API, a
 * server-side proxy) implements the exact same AddressProvider interface
 * (see packages/engines/entities/src/addressProvider.ts) and can replace
 * this one without any change to Entity Engine or to how addresses are
 * stored.
 */
const DEMO_LOCALITIES: LocalitySuggestion[] = [
  { id: 'loc-jerusalem', name: 'ירושלים', country: 'ישראל' },
  { id: 'loc-tel-aviv', name: 'תל אביב-יפו', country: 'ישראל' },
  { id: 'loc-bnei-brak', name: 'בני ברק', country: 'ישראל' },
  { id: 'loc-haifa', name: 'חיפה', country: 'ישראל' },
  { id: 'loc-beer-sheva', name: 'באר שבע', country: 'ישראל' },
  { id: 'loc-netanya', name: 'נתניה', country: 'ישראל' },
  { id: 'loc-raanana', name: 'רעננה', country: 'ישראל' },
  { id: 'loc-modiin', name: 'מודיעין-מכבים-רעות', country: 'ישראל' },
  { id: 'loc-ashdod', name: 'אשדוד', country: 'ישראל' },
  { id: 'loc-elad', name: 'אלעד', country: 'ישראל' },
  { id: 'loc-beitar-illit', name: 'ביתר עילית', country: 'ישראל' },
];

const DEMO_STREETS: StreetSuggestion[] = [
  { id: 'str-jer-1', localityId: 'loc-jerusalem', name: 'הרב קוק' },
  { id: 'str-jer-2', localityId: 'loc-jerusalem', name: 'יפו' },
  { id: 'str-jer-3', localityId: 'loc-jerusalem', name: 'מלכי ישראל' },
  { id: 'str-jer-4', localityId: 'loc-jerusalem', name: 'עזה' },
  { id: 'str-ta-1', localityId: 'loc-tel-aviv', name: 'הרצל' },
  { id: 'str-ta-2', localityId: 'loc-tel-aviv', name: 'דיזנגוף' },
  { id: 'str-ta-3', localityId: 'loc-tel-aviv', name: 'אבן גבירול' },
  { id: 'str-bb-1', localityId: 'loc-bnei-brak', name: 'רבי עקיבא' },
  { id: 'str-bb-2', localityId: 'loc-bnei-brak', name: 'ז׳בוטינסקי' },
  { id: 'str-haifa-1', localityId: 'loc-haifa', name: 'הנביאים' },
  { id: 'str-haifa-2', localityId: 'loc-haifa', name: 'העצמאות' },
  { id: 'str-bs-1', localityId: 'loc-beer-sheva', name: 'רגר' },
  { id: 'str-net-1', localityId: 'loc-netanya', name: 'הרצל' },
  { id: 'str-raa-1', localityId: 'loc-raanana', name: 'אחוזה' },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function delayed<T>(value: T): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), 120));
}

export const demoAddressProvider: AddressProvider = {
  id: 'demo-local',
  label: 'ספק כתובות הדגמה (מקומי)',

  async searchLocalities(query: string): Promise<AddressProviderResult<LocalitySuggestion>> {
    const normalizedQuery = normalize(query);
    const results = normalizedQuery ? DEMO_LOCALITIES.filter((locality) => normalize(locality.name).includes(normalizedQuery)) : DEMO_LOCALITIES;
    return delayed({ results, source: 'demo', verified: false });
  },

  async searchStreets(localityId: string, query: string): Promise<AddressProviderResult<StreetSuggestion>> {
    const normalizedQuery = normalize(query);
    const results = DEMO_STREETS.filter(
      (street) => street.localityId === localityId && (!normalizedQuery || normalize(street.name).includes(normalizedQuery)),
    );
    return delayed({ results, source: 'demo', verified: false });
  },

  async resolvePostalCode(): Promise<string | undefined> {
    // The demo provider does not have real postal-code data - a trusted provider would resolve one here.
    return undefined;
  },

  async validateAddress(address) {
    const issues: string[] = [];
    if (!address.city) {
      issues.push('לא נבחרה עיר.');
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
      providerId: 'demo-local',
      label: 'ספק כתובות הדגמה (מקומי)',
      datasetSource: 'רשימה מצומצמת לצורכי הדגמה בלבד - אינה מבוססת על מרשם רשמי.',
      snapshotDate: '2026-01-01',
      syncStatus: 'snapshot',
    };
  },
};
