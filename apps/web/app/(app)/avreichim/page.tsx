import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function AvreichimPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול כרטיסי אברכים, שיוך למוסדות ומעקב מלגות."
      capabilities={[
        'כרטיס אברך',
        'שיוך למספר מוסדות',
        'מלגות ותשלומים',
        'נוכחות',
        'מסמכים',
        'היסטוריית שינויים',
      ]}
    />
  );
}
