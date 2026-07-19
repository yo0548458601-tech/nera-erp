type StatCardProps = {
  title: string;
  value: string;
  meta: string;
  accent: 'cyan' | 'emerald' | 'amber' | 'violet';
};

const accentClasses = {
  cyan: 'from-cyan-500/15 to-cyan-500/5 text-cyan-700',
  emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700',
  amber: 'from-amber-500/15 to-amber-500/5 text-amber-700',
  violet: 'from-violet-500/15 to-violet-500/5 text-violet-700',
};

export function StatCard({ title, value, meta, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${accentClasses[accent]} p-5 shadow-sm`}
    >
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{meta}</p>
    </div>
  );
}
