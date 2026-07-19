import { type EntityFieldChange } from '@nera/entity-engine';
import { demoUser } from '../../lib/auth/demoData';
import { PanelCard } from '../PanelCard';

const fieldLabels: Record<string, string> = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  hebrewName: 'שם בעברית',
  idNumber: 'מספר זהות',
  birthDate: 'תאריך לידה',
  gender: 'מגדר',
  status: 'סטטוס',
  tags: 'תגיות',
  primaryPhone: 'טלפון ראשי',
  primaryEmail: 'דוא"ל ראשי',
};

/** Demo-only author resolution: the real system resolves changedByUserId through a Users service. */
function resolveUserName(userId: string): string {
  return userId === demoUser.id ? demoUser.name : userId;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  return String(value);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type PersonHistoryCardProps = {
  history: EntityFieldChange[];
};

/**
 * Displays the field-level change history recorded by EntityContext's
 * updatePerson (see @nera/entity-engine's history.ts contract). This is an
 * in-memory demo view, not a permanent audit database - it exists to show
 * the extension point actually working end to end.
 */
export function PersonHistoryCard({ history }: PersonHistoryCardProps) {
  const sorted = [...history].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return (
    <PanelCard title="היסטוריית שינויים" subtitle="שינויים בפרטי הזיהוי וההתקשרות של הישות.">
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">אין שינויים רשומים עדיין.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(change => (
            <li
              key={change.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm"
            >
              <p className="font-medium text-slate-800">
                {fieldLabels[change.field] ?? change.field}
              </p>
              <p className="mt-1 text-slate-600">
                מ-
                <span className="text-slate-400 line-through">
                  {formatValue(change.previousValue)}
                </span>{' '}
                ל-
                <span className="font-medium text-slate-800">{formatValue(change.newValue)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {resolveUserName(change.changedByUserId)} · {formatDateTime(change.changedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
