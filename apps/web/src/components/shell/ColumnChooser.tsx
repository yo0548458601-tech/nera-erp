'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Columns3 } from 'lucide-react';
import { type ListColumnDefinition } from '@nera/customization-engine';
import { useDismissableOverlay } from '../../hooks/useDismissableOverlay';

type ColumnChooserProps = {
  allColumns: ListColumnDefinition[];
  visibleColumnKeys: string[];
  onChange: (visibleColumnKeys: string[]) => void;
  onReset: () => void;
};

/**
 * "בחירת עמודות": choose which columns a list shows, in which order, with
 * a reset-to-effective-default action. Reusable for any future list that
 * adopts the same ListColumnDefinition[] + visibleColumnKeys[] contract
 * (see @nera/customization-engine's listViewColumns.ts) - nothing here is
 * contacts-specific. The required column (see ListColumnDefinition.required)
 * can never be unchecked, so a list can never end up with zero identifying
 * columns visible.
 */
export function ColumnChooser({ allColumns, visibleColumnKeys, onChange, onReset }: ColumnChooserProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismissableOverlay(open, () => setOpen(false), [panelRef, triggerRef]);

  const byKey = new Map(allColumns.map((column) => [column.key, column]));
  const hiddenKeysInDefaultOrder = allColumns
    .filter((column) => !visibleColumnKeys.includes(column.key))
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((column) => column.key);
  const displayOrder = [...visibleColumnKeys, ...hiddenKeysInDefaultOrder];

  const toggle = (key: string) => {
    const definition = byKey.get(key);
    if (definition?.required) {
      return;
    }
    onChange(visibleColumnKeys.includes(key) ? visibleColumnKeys.filter((entry) => entry !== key) : [...visibleColumnKeys, key]);
  };

  const move = (key: string, direction: -1 | 1) => {
    const index = visibleColumnKeys.indexOf(key);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= visibleColumnKeys.length) {
      return;
    }
    const next = [...visibleColumnKeys];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
      >
        <Columns3 size={15} aria-hidden="true" />
        בחירת עמודות
      </button>

      {open ? (
        <div ref={panelRef} className="absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {displayOrder.map((key) => {
              const definition = byKey.get(key);
              if (!definition) {
                return null;
              }
              const isVisible = visibleColumnKeys.includes(key);
              return (
                <li key={key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={isVisible} disabled={definition.required} onChange={() => toggle(key)} />
                    {definition.hebrewHeader}
                    {definition.required ? <span className="text-xs text-slate-400"> (חובה)</span> : null}
                  </label>
                  {isVisible ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => move(key, -1)}
                        aria-label={`הזז את ${definition.hebrewHeader} למעלה`}
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500"
                      >
                        <ChevronUp size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(key, 1)}
                        aria-label={`הזז את ${definition.hebrewHeader} למטה`}
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500"
                      >
                        <ChevronDown size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onReset}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            איפוס לברירת מחדל
          </button>
        </div>
      ) : null}
    </div>
  );
}
