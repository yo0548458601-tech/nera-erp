import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function PurchaseOrdersPage() {
  return (
    <ModulePlaceholderPage
      description="יצירה ומעקב אחר הזמנות רכש מול ספקים."
      capabilities={['יצירת הזמנת רכש', 'שיוך לספק ולתקציב', 'מעקב אספקה', 'התאמה מול חשבונית']}
    />
  );
}
