import {
  formatAddress,
  getPersonFullName,
  getPrimaryAddress,
  getPrimaryEmail,
  getPrimaryPhone,
  type PersonEntity,
  type RoleAssignment,
} from '@nera/entity-engine';
import { type CustomFieldDefinition, type CustomFieldValue, type ListColumnDefinition } from '@nera/customization-engine';
import { useRowClickNavigate } from '../../hooks/useRowNavigation';
import { computeHebrewBirthDate, formatGregorianBirthDate } from '../../lib/dates/hebrewBirthDate';
import { RowPrimaryLink } from '../shell/RowPrimaryLink';
import { formatCustomFieldValue } from '../customFields/CustomFieldInput';
import { PersonAvatar } from './PersonAvatar';
import { RoleBadge } from './RoleBadge';
import { StatusBadge } from './StatusBadge';

type PeopleTableProps = {
  people: PersonEntity[];
  roleAssignments: RoleAssignment[];
  /** Already filtered to the visible set, in display order (see contacts/page.tsx + ColumnChooser). */
  columns: ListColumnDefinition[];
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldValues: CustomFieldValue[];
};

/**
 * Renders one column-driven cell. Built-in columns are switched on by key;
 * a 'custom_field' column looks up its definition/value by key - this is
 * the one place list rendering and the ExcelColumnContract-driven export
 * conceptually agree on "what a column is" (a key + how to resolve it),
 * even though the table renders JSX and the export renders cell values.
 */
function renderCell(
  column: ListColumnDefinition,
  person: PersonEntity,
  roleAssignments: RoleAssignment[],
  customFieldDefinitions: CustomFieldDefinition[],
  customFieldValues: CustomFieldValue[],
) {
  switch (column.key) {
    case 'name': {
      const fullName = getPersonFullName(person.profile);
      return (
        <RowPrimaryLink href={`/contacts/${person.id}`} label={`פתח את הכרטיס של ${fullName}`}>
          <PersonAvatar profile={person.profile} size="sm" />
          <span>
            <span className="block font-medium text-slate-900">{fullName}</span>
            <span className="block text-xs text-slate-400">{person.neraId}</span>
          </span>
        </RowPrimaryLink>
      );
    }
    case 'roles': {
      const personRoles = roleAssignments.filter((assignment) => assignment.entityId === person.id);
      return (
        <div className="flex flex-wrap gap-1.5">
          {personRoles.length === 0 ? <span className="text-slate-400">—</span> : personRoles.map((assignment) => <RoleBadge key={assignment.id} role={assignment.role} />)}
        </div>
      );
    }
    case 'birthDateGregorian':
      return person.profile.birthDateGregorian ? formatGregorianBirthDate(person.profile.birthDateGregorian).display : '—';
    case 'birthDateHebrew':
      return person.profile.birthDateGregorian ? (
        <span dir="rtl">{computeHebrewBirthDate(person.profile.birthDateGregorian, person.profile.hebrewDateAdjustmentDays).display}</span>
      ) : (
        '—'
      );
    case 'phone':
      return getPrimaryPhone(person.profile)?.number ?? '—';
    case 'email':
      return getPrimaryEmail(person.profile)?.address ?? '—';
    case 'address': {
      const primary = getPrimaryAddress(person.profile);
      return primary ? formatAddress(primary) || '—' : '—';
    }
    case 'tags':
      return (
        <div className="flex flex-wrap gap-1">
          {person.tags.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            person.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {tag}
              </span>
            ))
          )}
        </div>
      );
    case 'status':
      return <StatusBadge status={person.status} />;
    default: {
      if (column.source === 'custom_field') {
        const definition = customFieldDefinitions.find((entry) => entry.key === column.key);
        if (!definition) {
          return '—';
        }
        const value = customFieldValues.find((entry) => entry.entityId === person.id && entry.customFieldDefinitionId === definition.id);
        return formatCustomFieldValue(value?.value);
      }
      return '—';
    }
  }
}

export function PeopleTable({ people, roleAssignments, columns, customFieldDefinitions, customFieldValues }: PeopleTableProps) {
  const getRowClickHandler = useRowClickNavigate();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-right text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-3 py-2">
                {column.hebrewHeader}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const href = `/contacts/${person.id}`;
            return (
              <tr
                key={person.id}
                onClick={getRowClickHandler(href)}
                className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50 focus-within:bg-slate-50"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-slate-600">
                    {renderCell(column, person, roleAssignments, customFieldDefinitions, customFieldValues)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
