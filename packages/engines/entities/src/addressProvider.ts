/**
 * Pluggable address-lookup contract. Entity Engine never hardcodes address
 * data (city/street lists) - it only stores the normalized structured
 * `Address` fields (see contactMethods.ts) plus optional provider-supplied
 * identifiers (`cityProviderId`/`streetProviderId`). A concrete
 * implementation of this interface (a "provider") belongs in the
 * integration/web layer - see apps/web/src/lib/address for the demo
 * provider used this sprint - so a future trusted provider (a government
 * address registry, a paid geocoding service, a server-side proxy) can
 * replace it without any change to this engine or to stored data.
 */
export type LocalitySuggestion = {
  id: string;
  name: string;
  country?: string;
  /** Official government locality code (e.g. the Israeli CBS "סמל יישוב"), when the provider has one. Absent for manual/unverified entries. */
  officialCode?: string;
};

export type StreetSuggestion = {
  id: string;
  name: string;
  localityId: string;
  /** Official government street code, when the provider has one. */
  officialCode?: string;
};

export type AddressProviderSource = 'demo' | 'government' | 'external';

export type AddressProviderResult<T> = {
  results: T[];
  source: AddressProviderSource;
  /** Whether matches from this provider represent an authoritative/verified source - a demo/local provider must always report false. */
  verified: boolean;
  /** True if the provider could not be reached/queried at all (as opposed to a genuine zero-match search) - callers must show a warning and fall back to manual entry, never pretend the dataset is complete. */
  unavailable?: boolean;
};

/**
 * Surfaced to administrator settings (see AddressProviderPanel): which
 * provider is active, where its data comes from, how fresh it is, and
 * whether it is currently reachable. Every AddressProvider implementation
 * must expose this so a future settings UI can show it without
 * provider-specific code.
 */
export type AddressProviderInfo = {
  providerId: string;
  label: string;
  datasetSource: string;
  /** ISO date the active dataset snapshot was compiled/verified, not necessarily today. */
  snapshotDate: string;
  syncStatus: 'snapshot' | 'synced' | 'unavailable';
};

export type AddressValidationResult = {
  valid: boolean;
  issues: string[];
};

export type AddressResolvePostalCodeInput = {
  localityId?: string;
  streetId?: string;
  houseNumber?: string;
};

/**
 * A pluggable address-lookup source. Implementations must never block
 * legitimate but unusual addresses (rural addresses, institutions, P.O.
 * boxes) - `searchLocalities`/`searchStreets` finding no match is expected
 * and normal; the caller (the address form) must always allow manual free
 * text entry as a fallback, marking the resulting Address as
 * `verified: false`.
 */
export interface AddressProvider {
  readonly id: string;
  readonly label: string;
  searchLocalities(query: string): Promise<AddressProviderResult<LocalitySuggestion>>;
  searchStreets(localityId: string, query: string): Promise<AddressProviderResult<StreetSuggestion>>;
  resolvePostalCode(input: AddressResolvePostalCodeInput): Promise<string | undefined>;
  validateAddress(address: Partial<{ country: string; city: string; street: string; houseNumber: string; postalCode: string }>): Promise<AddressValidationResult>;
  formatAddress(address: Partial<{ country: string; city: string; street: string; houseNumber: string; entrance: string; floor: string; apartment: string; postalCode: string }>): string;
  getProviderInfo(): AddressProviderInfo;
}
