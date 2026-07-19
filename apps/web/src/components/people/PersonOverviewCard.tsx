import { type PersonEntity, type PersonGender, getPersonFullName } from '@nera/entity-engine';
import { computeHebrewBirthDate, formatGregorianBirthDate } from '../../lib/dates/hebrewBirthDate';
import { PanelCard } from '../PanelCard';
import { PersonAvatar } from './PersonAvatar';
import { StatusBadge } from './StatusBadge';
import { DetailRow } from './DetailRow';

const genderLabels: Record<PersonGender, string> = {
  male: 'זכר',
  female: 'נקבה',
  unspecified: 'לא מוגדר',
};

export function PersonOverviewCard({ person }: { person: PersonEntity }) {
  const { birthDateGregorian, hebrewDateAdjustmentDays } = person.profile;
  const gregorianDisplay = birthDateGregorian
    ? formatGregorianBirthDate(birthDateGregorian).display
    : undefined;
  const hebrewDisplay = birthDateGregorian
    ? computeHebrewBirthDate(birthDateGregorian, hebrewDateAdjustmentDays).display
    : undefined;

  return (
    <PanelCard title="פרטים כלליים">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <PersonAvatar profile={person.profile} size="lg" />
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              {getPersonFullName(person.profile)}
            </h2>
            <StatusBadge status={person.status} />
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="מספר Nera" value={person.neraId} />
            <DetailRow label="מספר זהות" value={person.profile.idNumber} />
            <DetailRow label="תאריך לידה (לועזי)" value={gregorianDisplay} />
            <DetailRow label="תאריך לידה (עברי)" value={hebrewDisplay} />
            <DetailRow label="מגדר" value={genderLabels[person.profile.gender]} />
          </dl>

          {person.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {person.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </PanelCard>
  );
}
