import { getDateDisplayPair } from '../lib/calendar';

type DateDisplayProps = {
  value?: string | Date;
  className?: string;
};

export function DateDisplay({ value = '2026-07-12', className = '' }: DateDisplayProps) {
  const { gregorian, hebrew } = getDateDisplayPair(value);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">לועזי</p>
          <p className="mt-1 text-sm text-slate-700">{gregorian.display}</p>
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">עברי</p>
          <p className="mt-1 text-sm text-slate-700">{hebrew.display}</p>
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
      </div>
    </div>
  );
}
