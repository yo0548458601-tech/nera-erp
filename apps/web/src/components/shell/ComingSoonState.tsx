import { Construction } from 'lucide-react';
import { PanelCard } from '../PanelCard';

type ComingSoonStateProps = {
  capabilities: string[];
};

/**
 * Standard "בפיתוח" status block for module placeholder pages: a visible
 * development-status badge plus a short list of planned capabilities.
 * Never wires up fake save/database actions.
 */
export function ComingSoonState({ capabilities }: ComingSoonStateProps) {
  return (
    <PanelCard title="סטטוס פיתוח">
      <div className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          <Construction size={14} aria-hidden="true" />
          בפיתוח
        </span>

        <div>
          <p className="text-sm font-semibold text-slate-700">יכולות מתוכננות</p>
          <ul className="mt-2 space-y-2">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PanelCard>
  );
}
