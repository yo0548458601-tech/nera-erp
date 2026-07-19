import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
};

/** Generic pager reused by any future module list, not just People. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
      <p>
        מציג {firstItem}–{lastItem} מתוך {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="עמוד קודם"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <span className="px-2 text-slate-700">
          עמוד {page} מתוך {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="עמוד הבא"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
