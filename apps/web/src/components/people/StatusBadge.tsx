import { type EntityStatus } from '@nera/entity-engine';

const statusStyles: Record<EntityStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-amber-50 text-amber-700',
  archived: 'bg-slate-100 text-slate-600',
};

const statusLabels: Record<EntityStatus, string> = {
  active: 'פעיל',
  inactive: 'לא פעיל',
  archived: 'בארכיון',
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function getStatusLabel(status: EntityStatus): string {
  return statusLabels[status];
}
