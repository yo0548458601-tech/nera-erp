import { type AddressProvider } from '@nera/entity-engine';
import { israelGovernmentAddressProvider } from './israelGovernmentAddressProvider';

/**
 * The single indirection point for "which AddressProvider is currently
 * active." Every screen and editor that needs locality/street autocomplete
 * (AddressListEditor, AddressProviderPanel, ...) imports `activeAddressProvider`
 * from here instead of importing a concrete provider (e.g.
 * israelGovernmentAddressProvider) directly.
 *
 * Swapping providers - a future Google Places integration, an official
 * government API replacing this development snapshot, or any other
 * AddressProvider implementation - means changing the assignment below and
 * nothing else: Entity Engine has no provider-specific coupling (it only
 * knows the generic Address shape), and every UI component consumes only
 * the generic AddressProvider interface (searchLocalities/searchStreets/
 * getProviderInfo/...), never a provider-specific response shape. No
 * application screen needs to change when the provider changes.
 */
export const activeAddressProvider: AddressProvider = israelGovernmentAddressProvider;
