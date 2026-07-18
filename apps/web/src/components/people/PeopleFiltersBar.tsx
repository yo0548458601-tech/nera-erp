'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getHebrewMonthLength, getTodayIsoDate, listHebrewMonthNames, toHebrewNumeral } from '@nera/calendar-engine';
import {
  getRolesForEntityType,
  type EntityRoleId,
  type EntityStatus,
  type EntitySortKey,
  type SortDirection,
} from '@nera/entity-engine';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';
import { getStatusLabel } from './StatusBadge';

const statusOptions: EntityStatus[] = ['active', 'inactive', 'archived'];

type PeopleFiltersBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: EntityStatus[];
  onStatusFilterChange: (statuses: EntityStatus[]) => void;
  roleFilter: EntityRoleId[];
  onRoleFilterChange: (roles: EntityRoleId[]) => void;
  availableTags: string[];
  tagFilter: string[];
  onTagFilterChange: (tags: string[]) => void;
  sortKey: EntitySortKey;
  onSortKeyChange: (key: EntitySortKey) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (direction: SortDirection) => void;
  hebrewMonthFilter: number | '';
  onHebrewMonthFilterChange: (month: number | '') => void;
  hebrewDayFilter: number | '';
  onHebrewDayFilterChange: (day: number | '') => void;
  upcomingBirthdaysOnly: boolean;
  onUpcomingBirthdaysOnlyChange: (value: boolean) => void;
};

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function PeopleFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
  availableTags,
  tagFilter,
  onTagFilterChange,
  sortKey,
  onSortKeyChange,
  sortDirection,
  onSortDirectionChange,
  hebrewMonthFilter,
  onHebrewMonthFilterChange,
  hebrewDayFilter,
  onHebrewDayFilterChange,
  upcomingBirthdaysOnly,
  onUpcomingBirthdaysOnlyChange,
}: PeopleFiltersBarProps) {
  const { roles } = useRoleDefinitions();
  const personRoles = getRolesForEntityType(roles, 'person');
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const hebrewMonthNames = useMemo(() => listHebrewMonthNames(todayIso), [todayIso]);

  /**
   * The available Hebrew day options depend on the selected Hebrew month
   * (29 or 30 days - see getHebrewMonthLength) - never a flat 1-30 list
   * that would offer ל׳ for a 29-day month. With no month selected, the
   * broadest possible range (1-30) is offered since the day filter alone
   * is not yet month-scoped.
   */
  const hebrewMonthLength = hebrewMonthFilter ? getHebrewMonthLength(hebrewMonthFilter, todayIso) : 30;
  const hebrewDayOptions = useMemo(
    () => Array.from({ length: hebrewMonthLength }, (_, index) => index + 1),
    [hebrewMonthLength],
  );

  const [dayClearedMessage, setDayClearedMessage] = useState('');

  // If the selected month changes and the previously-selected day no longer exists in it, clear the day with visible feedback.
  useEffect(() => {
    if (hebrewDayFilter && hebrewDayFilter > hebrewMonthLength) {
      onHebrewDayFilterChange('');
      setDayClearedMessage(`בחירת היום אופסה - לחודש שנבחר אין יום ${toHebrewNumeral(hebrewDayFilter)}.`);
      window.setTimeout(() => setDayClearedMessage(''), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hebrewMonthLength]);

  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Search size={16} className="text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="חיפוש לפי שם, טלפון, דוא&quot;ל, ת.ז. או תגית"
            aria-label="חיפוש אנשי קשר"
            className="w-full bg-transparent text-sm text-slate-700 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="people-sort-key" className="text-sm text-slate-500">
            מיון:
          </label>
          <select
            id="people-sort-key"
            value={sortKey}
            onChange={(event) => onSortKeyChange(event.target.value as EntitySortKey)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="name">שם</option>
            <option value="createdAt">תאריך יצירה</option>
            <option value="status">סטטוס</option>
          </select>
          <button
            type="button"
            onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
            aria-label={sortDirection === 'asc' ? 'מיון עולה' : 'מיון יורד'}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">סטטוס:</span>
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusFilterChange(toggleValue(statusFilter, status))}
            aria-pressed={statusFilter.includes(status)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              statusFilter.includes(status)
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">תפקיד:</span>
        {personRoles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => onRoleFilterChange(toggleValue(roleFilter, role.key))}
            aria-pressed={roleFilter.includes(role.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              roleFilter.includes(role.key)
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">תאריך לידה עברי:</span>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          חודש עברי:
          <select
            value={hebrewMonthFilter}
            onChange={(event) => onHebrewMonthFilterChange(event.target.value ? Number(event.target.value) : '')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">הכל</option>
            {hebrewMonthNames.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          יום עברי בחודש:
          <select
            value={hebrewDayFilter}
            onChange={(event) => onHebrewDayFilterChange(event.target.value ? Number(event.target.value) : '')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">הכל</option>
            {hebrewDayOptions.map((day) => (
              <option key={day} value={day}>
                {toHebrewNumeral(day)}
              </option>
            ))}
          </select>
        </label>
        {dayClearedMessage ? (
          <span role="status" className="text-xs text-amber-700">
            {dayClearedMessage}
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => onUpcomingBirthdaysOnlyChange(!upcomingBirthdaysOnly)}
          aria-pressed={upcomingBirthdaysOnly}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            upcomingBirthdaysOnly ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          ימי הולדת עבריים קרובים (30 יום)
        </button>
      </div>

      {availableTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">תגיות:</span>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagFilterChange(toggleValue(tagFilter, tag))}
              aria-pressed={tagFilter.includes(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                tagFilter.includes(tag)
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
