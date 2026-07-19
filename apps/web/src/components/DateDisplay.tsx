import { getDateDisplayPair } from '../lib/calendar';

type DateDisplayProps = {
  value?: string | Date;
  className?: string;
  viewMode?: 'gregorian' | 'hebrew' | 'both';
};

export function DateDisplay({
  value = new Date(),
  className = '',
  viewMode = 'both',
}: DateDisplayProps) {
  const { gregorian, hebrew } = getDateDisplayPair(value);

  const showGregorian = viewMode === 'gregorian' || viewMode === 'both';
  const showHebrew = viewMode === 'hebrew' || viewMode === 'both';

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ${className}`}>
      {showGregorian ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">לועזי</p>
            <p className="mt-1 text-sm text-slate-700">{gregorian.display}</p>
          </div>
          <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
        </div>
      ) : null}
      {showHebrew ? (
        <div
          className={`mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 ${showGregorian ? '' : 'border-t-0 pt-0'}`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">עברי</p>
            <p className="mt-1 text-sm text-slate-700">{hebrew.display}</p>
          </div>
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        </div>
      ) : null}
    </div>
  );
}
