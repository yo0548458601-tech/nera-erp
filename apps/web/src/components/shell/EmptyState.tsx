import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

/** Generic empty-state block for lists/panels with no data to show. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      {Icon ? <Icon size={28} className="text-slate-400" aria-hidden="true" /> : null}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}
