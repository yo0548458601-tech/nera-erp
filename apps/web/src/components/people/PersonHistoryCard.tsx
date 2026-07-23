import { PanelCard } from '../PanelCard';

/**
 * Placeholder (P013A - see docs/ROADMAP.md and the P013A UI Behavior
 * Preservation matrix). Field-level change history is not persisted in
 * P013A - `audit_logs` records every entity mutation, but no read/query API
 * exists yet for it (see the P010 Audit Engine's own documented scope), so
 * there is no data source for a real history view. The in-memory
 * `EntityFieldChange` diffing this card previously rendered is removed
 * along with `EntityContext`'s `fieldHistory`/`getHistoryForEntity`.
 */
export function PersonHistoryCard() {
  return (
    <PanelCard title="היסטוריית שינויים" subtitle="שינויים בפרטי הזיהוי וההתקשרות של הישות.">
      <p className="text-sm text-slate-400">
        תצוגת היסטוריית שינויים תתווסף בעתיד, בהתבסס על יומן הביקורת (Audit Log).
      </p>
    </PanelCard>
  );
}
