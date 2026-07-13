import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinanceInvoicesPage() {
  return (
    <ModulePlaceholderPage
      description="הפקה, ניהול ומעקב אחר חשבוניות."
      capabilities={['הפקת חשבונית', 'מעקב סטטוס תשלום', 'שיוך ללקוח או לספק', 'ייצוא לרואה חשבון']}
    />
  );
}
