import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinancePaymentsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול תשלומים יוצאים ומעקב סטטוס תשלום."
      capabilities={['רישום תשלומים יוצאים', 'אישור תשלום בתהליך עבודה', 'שיוך לחשבונית מקור', 'מעקב תזרים']}
    />
  );
}
