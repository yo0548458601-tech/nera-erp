import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function AssetsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול נכסי הארגון ומעקב אחר מיקום ואחריות."
      capabilities={['כרטיס נכס', 'שיוך לעובד או למחלקה', 'מעקב מיקום', 'היסטוריית תחזוקה']}
    />
  );
}
