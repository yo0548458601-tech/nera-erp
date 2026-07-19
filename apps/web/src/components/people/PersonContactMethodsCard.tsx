import { excludeDeleted, formatAddress, type PersonEntity } from '@nera/entity-engine';
import { PanelCard } from '../PanelCard';

function ContactMethodRow({
  label,
  isPrimary,
  isInactive,
  notes,
  extraBadge,
}: {
  label: string;
  isPrimary: boolean;
  isInactive?: boolean;
  notes?: string;
  extraBadge?: string;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${
        isInactive
          ? 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
          : 'border-slate-100 bg-slate-50 text-slate-800'
      }`}
    >
      <span>{label}</span>
      {isPrimary ? (
        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">
          ראשי
        </span>
      ) : null}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${isInactive ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
      >
        {isInactive ? 'לא פעיל' : 'פעיל'}
      </span>
      {extraBadge ? (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {extraBadge}
        </span>
      ) : null}
      {notes ? <span className="text-xs text-slate-400">{notes}</span> : null}
    </li>
  );
}

/**
 * Shows every non-removed phone/email/address on the entity - never just
 * the primary one, per the platform rule that multiple contact methods
 * must never be collapsed to a single display. A soft-deleted ("הוסר")
 * contact method is excluded here entirely (see excludeDeleted) - it is
 * only visible again through the create/edit form's "פריטים שהוסרו"
 * restore list, never on the read-only detail page.
 */
export function PersonContactMethodsCard({ person }: { person: PersonEntity }) {
  const phones = excludeDeleted(person.profile.phones);
  const emails = excludeDeleted(person.profile.emails);
  const addresses = excludeDeleted(person.profile.addresses);

  return (
    <PanelCard title="פרטי התקשרות">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">טלפון</p>
          {phones.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">לא הוזן טלפון.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {[...phones]
                .sort((a, b) => a.order - b.order)
                .map(phone => (
                  <ContactMethodRow
                    key={phone.id}
                    label={`${phone.number} (${phone.label})`}
                    isPrimary={phone.isPrimary}
                    isInactive={phone.status === 'inactive'}
                    notes={phone.notes}
                  />
                ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            כתובת דוא&quot;ל
          </p>
          {emails.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">לא הוזנה כתובת דוא&quot;ל.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {[...emails]
                .sort((a, b) => a.order - b.order)
                .map(email => (
                  <ContactMethodRow
                    key={email.id}
                    label={`${email.address} (${email.label})`}
                    isPrimary={email.isPrimary}
                    isInactive={email.status === 'inactive'}
                    notes={email.notes}
                  />
                ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">כתובת</p>
          {addresses.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">לא הוזנה כתובת.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {[...addresses]
                .sort((a, b) => a.order - b.order)
                .map(address => (
                  <ContactMethodRow
                    key={address.id}
                    label={formatAddress(address) || 'כתובת ללא פרטים'}
                    isPrimary={address.isPrimary}
                    isInactive={address.status === 'inactive'}
                    notes={address.notes}
                    extraBadge={address.verified ? 'מאומתת' : 'לא מאומתת - הוזנה ידנית'}
                  />
                ))}
            </ul>
          )}
        </div>
      </div>
    </PanelCard>
  );
}
