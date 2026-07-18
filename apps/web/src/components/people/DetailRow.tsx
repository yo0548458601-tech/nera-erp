type DetailRowProps = {
  label: string;
  value?: string | null;
};

/** A small label/value pair, reused across the person detail cards. */
export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{value || '—'}</dd>
    </div>
  );
}
