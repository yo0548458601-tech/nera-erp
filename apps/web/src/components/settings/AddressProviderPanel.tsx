'use client';

import { activeAddressProvider } from '../../lib/address/activeAddressProvider';
import { PanelCard } from '../PanelCard';

const syncStatusLabels: Record<string, string> = {
  snapshot: 'תמונת פיתוח (טרם סונכרנה מול מקור חי)',
  synced: 'מסונכרן',
  unavailable: 'לא זמין',
};

/**
 * Read-only display of the currently active AddressProvider (see
 * addressProvider.ts's AddressProviderInfo), read exclusively through
 * activeAddressProvider.ts's single indirection point - provider id,
 * dataset source description, snapshot date, sync status. This sprint
 * wires exactly one concrete provider (israelGovernmentAddressProvider);
 * the AddressProvider abstraction is preserved so a future settings
 * control could let an administrator choose between this, a demo
 * provider, or a future Google Places provider - that switching UI is a
 * documented future extension, not built this sprint (see the completion
 * report). Because this panel only calls the generic interface, wiring
 * such a control would not require changing this file's rendering logic.
 */
export function AddressProviderPanel() {
  const info = activeAddressProvider.getProviderInfo();

  return (
    <PanelCard title="ספק כתובות" subtitle="מצב הדגמה - תצוגה בלבד. בחירת ספק כתובות מוגדרת תתווסף בעתיד.">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">ספק פעיל</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{info.label}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">מקור הנתונים</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{info.datasetSource}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">תאריך תמונת מצב</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{info.snapshotDate}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">סטטוס סנכרון</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{syncStatusLabels[info.syncStatus] ?? info.syncStatus}</dd>
        </div>
      </dl>
    </PanelCard>
  );
}
