'use client';

import { useEffect, useState } from 'react';
import { type AddressDraft, type AddressType } from '@nera/entity-engine';
import { useMyPermission } from '../../context/AuthorizationContext';
import { ListFieldEditor } from '../shared/ListFieldEditor';
import { AddressAutocompleteInput } from '../shared/AddressAutocompleteInput';
import { activeAddressProvider } from '../../lib/address/activeAddressProvider';

const addressTypeLabels: Record<AddressType, string> = {
  home: 'בית',
  work: 'עבודה',
  billing: 'חיוב',
  mailing: 'דואר',
  registered: 'רשום',
  other: 'אחר',
};
const addressTypes: AddressType[] = ['home', 'work', 'billing', 'mailing', 'registered', 'other'];

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyAddressDraft(): AddressDraft {
  return {
    id: createId('address'),
    type: 'home',
    isPrimary: false,
    status: 'active',
    verified: false,
    order: 0,
    country: 'ישראל',
  };
}

type AddressFieldsProps = {
  item: AddressDraft;
  update: (patch: Partial<AddressDraft>) => void;
};

/**
 * A real function component (not an inline render-prop body) specifically
 * so it can hold its own state/effects - needed to proactively check
 * "does this locality have any streets in the snapshot at all" and show a
 * clear, honest message when it doesn't (see noStreetsForLocality below),
 * rather than ever silently showing an empty dropdown with no
 * explanation.
 */
function AddressFields({ item, update }: AddressFieldsProps) {
  const [providerWarning, setProviderWarning] = useState('');
  const [noStreetsForLocality, setNoStreetsForLocality] = useState(false);

  useEffect(() => {
    if (!item.cityProviderId) {
      setNoStreetsForLocality(false);
      return;
    }
    let cancelled = false;
    activeAddressProvider.searchStreets(item.cityProviderId, '').then((result) => {
      if (cancelled) {
        return;
      }
      setNoStreetsForLocality(!result.unavailable && result.results.length === 0);
    });
    return () => {
      cancelled = true;
    };
  }, [item.cityProviderId]);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">מדינה</span>
        <input
          value={item.country ?? ''}
          onChange={(event) => update({ country: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>

      <div />

      <AddressAutocompleteInput
        label="עיר / יישוב"
        value={item.city ?? ''}
        placeholder="הקלד לחיפוש..."
        onChange={(text) =>
          update({ city: text, cityProviderId: undefined, street: item.city === text ? item.street : undefined, streetProviderId: undefined, verified: false })
        }
        onSelectSuggestion={(suggestion) =>
          update({ city: suggestion.name, cityProviderId: suggestion.id, street: undefined, streetProviderId: undefined, verified: true })
        }
        fetchSuggestions={async (query) => {
          const result = await activeAddressProvider.searchLocalities(query);
          setProviderWarning(result.unavailable ? 'ספק הכתובות אינו זמין כרגע - ניתן להזין את הכתובת ידנית.' : '');
          return result.results.map((entry) => ({ id: entry.id, name: entry.name }));
        }}
      />
      <AddressAutocompleteInput
        label="רחוב"
        value={item.street ?? ''}
        placeholder={item.cityProviderId ? 'הקלד לחיפוש...' : 'יש לבחור עיר/יישוב תחילה, או להקליד ידנית'}
        /**
         * The street field's own text/open state does not change the
         * moment the user picks a locality, so its fetch effect would
         * otherwise never notice that streets are now available (this was
         * the actual root cause of "street autocomplete returns nothing
         * after selecting a locality" - see AddressAutocompleteInput's
         * contextKey docstring). Passing cityProviderId here forces a
         * refetch on that transition even if the street field was already
         * open/empty from before the locality was selected - always
         * scoped to the currently selected locality's id, per the
         * platform rule that street lookup must always use the selected
         * locality id.
         */
        contextKey={item.cityProviderId}
        onChange={(text) => update({ street: text, streetProviderId: undefined, verified: item.cityProviderId ? item.verified : false })}
        onSelectSuggestion={(suggestion) => update({ street: suggestion.name, streetProviderId: suggestion.id, verified: true })}
        fetchSuggestions={async (query) => {
          if (!item.cityProviderId) {
            return [];
          }
          const result = await activeAddressProvider.searchStreets(item.cityProviderId, query);
          setProviderWarning(result.unavailable ? 'ספק הכתובות אינו זמין כרגע - ניתן להזין את הכתובת ידנית.' : '');
          return result.results.map((entry) => ({ id: entry.id, name: entry.name }));
        }}
      />

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">מספר בית</span>
        <input
          value={item.houseNumber ?? ''}
          onChange={(event) => update({ houseNumber: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">כניסה</span>
        <input
          value={item.entrance ?? ''}
          onChange={(event) => update({ entrance: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">קומה</span>
        <input
          value={item.floor ?? ''}
          onChange={(event) => update({ floor: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">דירה</span>
        <input
          value={item.apartment ?? ''}
          onChange={(event) => update({ apartment: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">מיקוד</span>
        <input
          value={item.postalCode ?? ''}
          onChange={(event) => update({ postalCode: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">סוג כתובת</span>
        <select
          value={item.type}
          onChange={(event) => update({ type: event.target.value as AddressType })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        >
          {addressTypes.map((type) => (
            <option key={type} value={type}>
              {addressTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2">
        <span className="font-medium text-slate-600">הערות</span>
        <input
          value={item.notes ?? ''}
          onChange={(event) => update({ notes: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>

      <p className="text-[11px] text-slate-400 sm:col-span-2">
        {item.verified ? 'כתובת מאומתת מול ספק הכתובות.' : 'כתובת הוזנה ידנית - לא מאומתת מול ספק הכתובות.'}
      </p>
      {noStreetsForLocality ? (
        <p role="status" className="text-[11px] text-slate-500 sm:col-span-2">
          לא נמצאו רחובות עבור יישוב זה במאגר הנוכחי - ניתן להזין את שם הרחוב ידנית.
        </p>
      ) : null}
      {providerWarning ? (
        <p role="alert" className="text-[11px] text-amber-700 sm:col-span-2">
          {providerWarning}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Multi-address editor. Field order matches the approved P007.5 order:
 * מדינה, עיר/יישוב, רחוב, מספר בית, כניסה, קומה, דירה, מיקוד, סוג כתובת,
 * הערות (primary/status are shown by the shared ListFieldEditor's action
 * area, consistently with phones/emails).
 *
 * City -> street autocomplete uses activeAddressProvider (see
 * activeAddressProvider.ts) - the single indirection point selecting the
 * primary provider (currently israelGovernmentAddressProvider, backed by a
 * documented Israeli locality/street snapshot). This component only ever
 * calls the generic AddressProvider interface, never a provider-specific
 * shape, so swapping providers touches activeAddressProvider.ts alone. If a
 * search comes back `unavailable` (see AddressProviderResult), a warning is
 * shown and manual entry remains fully available (it always is, regardless).
 */
export function AddressListEditor({ addresses, onChange, currentUserId }: { addresses: AddressDraft[]; onChange: (addresses: AddressDraft[]) => void; currentUserId: string }) {
  const canEdit = useMyPermission('contact_methods.edit');
  const canDeactivate = useMyPermission('contact_methods.deactivate');
  const canRemove = useMyPermission('contact_methods.remove');
  const canRestore = useMyPermission('contact_methods.restore');

  return (
    <ListFieldEditor
      groupName="primary-address"
      items={addresses}
      onChange={onChange}
      createItem={createEmptyAddressDraft}
      addLabel="הוסף כתובת נוספת"
      emptyLabel="לא הוזנה כתובת."
      itemAriaLabel={(item) => `כתובת ${item.city ?? item.street ?? 'חדשה'}`}
      currentUserId={currentUserId}
      activeStatusLabel="פעילה"
      inactiveStatusLabel="לא פעילה"
      deactivateActionLabel="הפוך ללא פעילה"
      reactivateActionLabel="הפעל מחדש"
      removeActionLabel="הסר כתובת"
      removeConfirmMessage='להסיר את הכתובת? ניתן יהיה לשחזר אותה מהרשימה "כתובות שהוסרו".'
      removedSectionLabel="כתובות שהוסרו"
      canEdit={canEdit}
      canDeactivate={canDeactivate}
      canRemove={canRemove}
      canRestore={canRestore}
      renderFields={(item, update) => <AddressFields item={item} update={update} />}
    />
  );
}
