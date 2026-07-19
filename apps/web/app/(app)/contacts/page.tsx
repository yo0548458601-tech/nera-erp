'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, UserPlus } from 'lucide-react';
import { getBuiltInDefaultColumnKeys, type ListColumnDefinition } from '@nera/customization-engine';
import {
  queryEntities,
  type EntityRoleId,
  type EntitySortKey,
  type EntityStatus,
  type SortDirection,
} from '@nera/entity-engine';
import { getTodayIsoDate } from '@nera/calendar-engine';
import { useEntities } from '@/src/context/EntityContext';
import { useCustomFields } from '@/src/context/CustomFieldContext';
import { useMyPermission } from '@/src/context/AuthorizationContext';
import { useSession } from '@/src/context/SessionContext';
import { useListViewPreferences } from '@/src/context/ListViewPreferenceContext';
import { usePageSize } from '@/src/hooks/usePageSize';
import { getHebrewBirthDateParts } from '@/src/lib/dates/hebrewBirthDate';
import {
  isUpcomingHebrewBirthday,
  matchesHebrewDay,
  matchesHebrewMonth,
} from '@/src/lib/dates/hebrewBirthdayFilters';
import { buildPersonExcelColumns } from '@/src/lib/excel/personColumns';
import { buildExportFileName, buildXlsxWorkbookBuffer } from '@/src/lib/excel/xlsxWriter';
import {
  CONTACTS_SCREEN_ID,
  useContactsListColumnDefinitions,
} from '@/src/config/contactsListColumns';
import { demoOrganizations } from '@/src/lib/auth/demoData';
import { PageHeader } from '@/src/components/shell/PageHeader';
import { Pagination } from '@/src/components/shell/Pagination';
import { PageSizeSelect } from '@/src/components/shell/PageSizeSelect';
import { ColumnChooser } from '@/src/components/shell/ColumnChooser';
import { EmptyState } from '@/src/components/shell/EmptyState';
import { PeopleFiltersBar } from '@/src/components/people/PeopleFiltersBar';
import { PeopleTable } from '@/src/components/people/PeopleTable';
import { PersonFormDialog } from '@/src/components/people/PersonFormDialog';

const PAGE_SIZE_STORAGE_KEY = 'nera:page-size:contacts';
const UPCOMING_BIRTHDAY_WINDOW_DAYS = 30;

export default function ContactsPage() {
  const router = useRouter();
  const { session } = useSession();
  const { entities, roleAssignments } = useEntities();
  const { definitions: customFieldDefinitions, values: customFieldValues } = useCustomFields();
  const canExport = useMyPermission('entities.export');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntityStatus[]>([]);
  const [roleFilter, setRoleFilter] = useState<EntityRoleId[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<EntitySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZE_STORAGE_KEY, 25);
  const [hebrewMonthFilter, setHebrewMonthFilter] = useState<number | ''>('');
  const [hebrewDayFilter, setHebrewDayFilter] = useState<number | ''>('');
  const [upcomingBirthdaysOnly, setUpcomingBirthdaysOnly] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [exportVisibleColumnsOnly, setExportVisibleColumnsOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const addTriggerRef = useRef<HTMLButtonElement>(null);

  const allColumnDefinitions = useContactsListColumnDefinitions();
  const { getEffectiveColumns, setMyColumns, resetMyColumns } = useListViewPreferences();
  const builtInDefaultColumnKeys = useMemo(
    () => getBuiltInDefaultColumnKeys(allColumnDefinitions),
    [allColumnDefinitions]
  );
  const effectiveColumns = getEffectiveColumns(CONTACTS_SCREEN_ID, builtInDefaultColumnKeys);
  const visibleColumnKeys = effectiveColumns.visibleColumnKeys;
  const columnByKey = useMemo(
    () => new Map(allColumnDefinitions.map(column => [column.key, column])),
    [allColumnDefinitions]
  );
  const visibleColumns: ListColumnDefinition[] = visibleColumnKeys
    .map(key => columnByKey.get(key))
    .filter((column): column is ListColumnDefinition => Boolean(column));

  const availableTags = useMemo(
    () =>
      Array.from(new Set(entities.flatMap(entity => entity.tags))).sort((a, b) =>
        a.localeCompare(b, 'he')
      ),
    [entities]
  );

  const baseFilteredPeople = useMemo(
    () =>
      queryEntities(entities, roleAssignments, {
        search,
        filters: { status: statusFilter, roles: roleFilter, tags: tagFilter },
        sortKey,
        sortDirection,
      }),
    [entities, roleAssignments, search, statusFilter, roleFilter, tagFilter, sortKey, sortDirection]
  );

  const filteredPeople = useMemo(() => {
    if (!hebrewMonthFilter && !hebrewDayFilter && !upcomingBirthdaysOnly) {
      return baseFilteredPeople;
    }
    const todayIso = getTodayIsoDate();
    return baseFilteredPeople.filter(person => {
      if (!person.profile.birthDateGregorian) {
        return false;
      }
      const parts = getHebrewBirthDateParts(
        person.profile.birthDateGregorian,
        person.profile.hebrewDateAdjustmentDays
      );
      if (hebrewMonthFilter && !matchesHebrewMonth(parts, hebrewMonthFilter)) {
        return false;
      }
      if (hebrewDayFilter && !matchesHebrewDay(parts, hebrewDayFilter)) {
        return false;
      }
      if (
        upcomingBirthdaysOnly &&
        !isUpcomingHebrewBirthday(
          person.profile.birthDateGregorian,
          person.profile.hebrewDateAdjustmentDays,
          todayIso,
          UPCOMING_BIRTHDAY_WINDOW_DAYS
        )
      ) {
        return false;
      }
      return true;
    });
  }, [baseFilteredPeople, hebrewMonthFilter, hebrewDayFilter, upcomingBirthdaysOnly]);

  const effectivePageSize =
    pageSize === 'unlimited' ? Math.max(filteredPeople.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(filteredPeople.length / effectivePageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedPeople =
    pageSize === 'unlimited'
      ? filteredPeople
      : filteredPeople.slice(
          (currentPage - 1) * effectivePageSize,
          currentPage * effectivePageSize
        );

  function withFilterReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const handlePageSizeChange = (value: typeof pageSize) => {
    setPageSize(value);
    setPage(1);
  };

  /**
   * Real .xlsx export via the reusable workbook writer (see xlsxWriter.ts)
   * - not CSV. "עמודות מוצגות בלבד" narrows the export to the list's
   * currently visible columns; unchecked (the default), every configured
   * export-enabled column is included regardless of what the list happens
   * to show right now - the two are independent choices, per the platform
   * rule that visible-list selection must not silently limit export.
   */
  const handleExportXlsx = async () => {
    setIsExporting(true);
    try {
      const allExportColumns = buildPersonExcelColumns(customFieldDefinitions, customFieldValues);
      const columns = exportVisibleColumnsOnly
        ? allExportColumns.filter(column => visibleColumnKeys.includes(column.columnKey))
        : allExportColumns;

      const organizationName =
        demoOrganizations.find(organization => organization.id === session?.selectedOrganizationId)
          ?.name ?? 'Nera';
      const fileName = buildExportFileName(organizationName, 'אנשי קשר');

      const buffer = await buildXlsxWorkbookBuffer({
        sheetName: 'אנשי קשר',
        columns,
        records: filteredPeople,
      });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        subtitle="ניהול מרכזי של כל בני האדם המוכרים לארגון - אדם אחד יכול להחזיק במספר תפקידים בו-זמנית."
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            {canExport ? (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={exportVisibleColumnsOnly}
                    onChange={event => setExportVisibleColumnsOnly(event.target.checked)}
                  />
                  עמודות מוצגות בלבד
                </label>
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  <Download size={16} aria-hidden="true" />
                  {isExporting ? 'מייצא...' : 'ייצוא לאקסל'}
                </button>
              </div>
            ) : null}
            <button
              ref={addTriggerRef}
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <UserPlus size={16} aria-hidden="true" />
              הוספת איש קשר חדש
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <PeopleFiltersBar
          search={search}
          onSearchChange={withFilterReset(setSearch)}
          statusFilter={statusFilter}
          onStatusFilterChange={withFilterReset(setStatusFilter)}
          roleFilter={roleFilter}
          onRoleFilterChange={withFilterReset(setRoleFilter)}
          availableTags={availableTags}
          tagFilter={tagFilter}
          onTagFilterChange={withFilterReset(setTagFilter)}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
          hebrewMonthFilter={hebrewMonthFilter}
          onHebrewMonthFilterChange={withFilterReset(setHebrewMonthFilter)}
          hebrewDayFilter={hebrewDayFilter}
          onHebrewDayFilterChange={withFilterReset(setHebrewDayFilter)}
          upcomingBirthdaysOnly={upcomingBirthdaysOnly}
          onUpcomingBirthdaysOnlyChange={withFilterReset(setUpcomingBirthdaysOnly)}
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <ColumnChooser
            allColumns={allColumnDefinitions}
            visibleColumnKeys={visibleColumnKeys}
            onChange={keys => setMyColumns(CONTACTS_SCREEN_ID, keys)}
            onReset={() => resetMyColumns(CONTACTS_SCREEN_ID)}
          />
          <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          {filteredPeople.length === 0 ? (
            <EmptyState
              title="לא נמצאו אנשי קשר"
              description="נסו לשנות את מסנני החיפוש או להוסיף איש קשר חדש."
            />
          ) : (
            <>
              <PeopleTable
                people={paginatedPeople}
                roleAssignments={roleAssignments}
                columns={visibleColumns}
                customFieldDefinitions={customFieldDefinitions}
                customFieldValues={customFieldValues}
              />
              {pageSize !== 'unlimited' ? (
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  totalItems={filteredPeople.length}
                  pageSize={effectivePageSize}
                />
              ) : (
                <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                  מוצגות כל {filteredPeople.length} התוצאות (ללא הגבלת עמודים).
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <PersonFormDialog
        open={addDialogOpen}
        mode="create"
        onClose={() => setAddDialogOpen(false)}
        onCreated={person => {
          setAddDialogOpen(false);
          router.push(`/contacts/${person.id}`);
        }}
        restoreFocusRef={addTriggerRef}
      />
    </>
  );
}
