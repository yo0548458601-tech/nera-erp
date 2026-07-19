'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ReactNode } from 'react';

export type ListEditorItem = {
  id: string;
  isPrimary: boolean;
  status: 'active' | 'inactive';
  order: number;
  /** Soft-delete marker (see contactMethods.ts SoftDeletable) - a removed item is hidden from the main list but always restorable, never hard-deleted. */
  deletedAt?: string | null;
  deletedByUserId?: string;
};

type ListFieldEditorProps<T extends ListEditorItem> = {
  groupName: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  addLabel: string;
  emptyLabel: string;
  itemAriaLabel: (item: T, index: number) => string;
  currentUserId: string;
  primaryLabel?: string;
  /** Grammatically-correct per-type Hebrew labels (e.g. "פעילה"/"לא פעילה" for a כתובת, "פעיל"/"לא פעיל" for a טלפון) - no single generic label works for all Hebrew genders, so the caller supplies them. */
  activeStatusLabel: string;
  inactiveStatusLabel: string;
  deactivateActionLabel: string;
  reactivateActionLabel: string;
  removeActionLabel: string;
  removeConfirmMessage: string;
  restoreActionLabel?: string;
  removedSectionLabel?: string;
  /** Permission gates - each action is independently controllable (see contact_methods.edit/deactivate/remove/restore). Default true so existing callers that don't pass these keep working. */
  canEdit?: boolean;
  canDeactivate?: boolean;
  canRemove?: boolean;
  canRestore?: boolean;
};

/**
 * Reusable "repeatable record" editor shared by phones, emails and
 * addresses (and any future multi-value profile field): add/edit/reorder,
 * mark-one-as-primary (radio semantics - never two primaries at once
 * within this list), explicit deactivate/reactivate (the record stays,
 * just isn't treated as a default/primary contact method), and an
 * explicit, confirmed, soft-delete "remove" action that is always
 * restorable (see contactMethods.ts's SoftDeletable) - never a permanent
 * deletion in this sprint. Every action is independently permission-gated.
 */
export function ListFieldEditor<T extends ListEditorItem>({
  groupName,
  items,
  onChange,
  createItem,
  renderFields,
  addLabel,
  emptyLabel,
  itemAriaLabel,
  currentUserId,
  primaryLabel = 'ראשי',
  activeStatusLabel,
  inactiveStatusLabel,
  deactivateActionLabel,
  reactivateActionLabel,
  removeActionLabel,
  removeConfirmMessage,
  restoreActionLabel = 'שחזר',
  removedSectionLabel = 'פריטים שהוסרו',
  canEdit = true,
  canDeactivate = true,
  canRemove = true,
  canRestore = true,
}: ListFieldEditorProps<T>) {
  const [showRemoved, setShowRemoved] = useState(false);

  const visibleItems = items.filter(item => !item.deletedAt);
  const removedItems = items.filter(item => item.deletedAt);
  const sorted = [...visibleItems].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    const created = createItem();
    onChange([
      ...items,
      { ...created, isPrimary: visibleItems.length === 0, order: visibleItems.length },
    ]);
  };

  const updateItem = (id: string, patch: Partial<T>) => {
    onChange(items.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const setPrimary = (id: string) => {
    onChange(items.map(item => (item.deletedAt ? item : { ...item, isPrimary: item.id === id })));
  };

  const toggleActive = (id: string) => {
    onChange(
      items.map(item =>
        item.id === id
          ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm(removeConfirmMessage)) {
      return;
    }
    const now = new Date().toISOString();
    const target = items.find(item => item.id === id);
    let next = items.map(item =>
      item.id === id
        ? { ...item, deletedAt: now, deletedByUserId: currentUserId, isPrimary: false }
        : item
    );
    const remainingVisible = next.filter(item => !item.deletedAt);
    if (
      target?.isPrimary &&
      remainingVisible.length > 0 &&
      !remainingVisible.some(item => item.isPrimary)
    ) {
      const firstId = remainingVisible[0].id;
      next = next.map(item => (item.id === firstId ? { ...item, isPrimary: true } : item));
    }
    onChange(next);
  };

  const restoreItem = (id: string) => {
    onChange(
      items.map(item =>
        item.id === id ? { ...item, deletedAt: null, deletedByUserId: undefined } : item
      )
    );
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const currentIndex = sorted.findIndex(item => item.id === id);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return;
    }
    const reordered = [...sorted];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    const reorderedIds = new Set(reordered.map(item => item.id));
    const orderById = new Map(reordered.map((item, index) => [item.id, index]));
    onChange(
      items.map(item =>
        reorderedIds.has(item.id) ? { ...item, order: orderById.get(item.id)! } : item
      )
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {sorted.length === 0 ? <p className="text-sm text-slate-400">{emptyLabel}</p> : null}

      {sorted.map((item, index) => (
        <div
          key={item.id}
          role="group"
          aria-label={itemAriaLabel(item, index)}
          className={`rounded-2xl border p-3 ${
            item.status === 'inactive'
              ? 'border-dashed border-slate-200 bg-slate-50 opacity-70'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              {renderFields(item, canEdit ? patch => updateItem(item.id, patch) : () => undefined)}
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {canEdit ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={index === 0}
                    aria-label={`הזז ${itemAriaLabel(item, index)} למעלה`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={index === sorted.length - 1}
                    aria-label={`הזז ${itemAriaLabel(item, index)} למטה`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              {canEdit ? (
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="radio"
                    name={groupName}
                    checked={item.isPrimary}
                    onChange={() => setPrimary(item.id)}
                  />
                  {primaryLabel}
                </label>
              ) : item.isPrimary ? (
                <span className="text-xs text-cyan-700">{primaryLabel}</span>
              ) : null}

              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  item.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item.status === 'active' ? activeStatusLabel : inactiveStatusLabel}
              </span>

              {canDeactivate ? (
                <button
                  type="button"
                  onClick={() => toggleActive(item.id)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  {item.status === 'active' ? deactivateActionLabel : reactivateActionLabel}
                </button>
              ) : null}

              {canRemove ? (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  {removeActionLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {canEdit ? (
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
        >
          {addLabel}
        </button>
      ) : null}

      {canRestore && removedItems.length > 0 ? (
        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowRemoved(value => !value)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showRemoved ? 'הסתר' : 'הצג'} {removedSectionLabel} ({removedItems.length})
          </button>
          {showRemoved ? (
            <ul className="mt-2 space-y-1.5">
              {removedItems.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
                >
                  <span className="line-through">{itemAriaLabel(item, index)}</span>
                  <button
                    type="button"
                    onClick={() => restoreItem(item.id)}
                    className="font-medium text-cyan-700 hover:underline"
                  >
                    {restoreActionLabel}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
