'use client';

import { PAGE_SIZE_OPTIONS, type PageSizeOption } from '../../hooks/usePageSize';

type PageSizeSelectProps = {
  value: PageSizeOption;
  onChange: (value: PageSizeOption) => void;
};

function optionLabel(option: PageSizeOption): string {
  return option === 'unlimited' ? 'ללא הגבלה' : String(option);
}

/** Reusable rows-per-page selector, paired with usePageSize - any future list can drop this in unchanged. */
export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="page-size-select" className="text-sm text-slate-500">
        שורות בעמוד:
      </label>
      <select
        id="page-size-select"
        value={String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === 'unlimited' ? 'unlimited' : (Number(raw) as PageSizeOption));
        }}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm"
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={String(option)} value={String(option)}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
