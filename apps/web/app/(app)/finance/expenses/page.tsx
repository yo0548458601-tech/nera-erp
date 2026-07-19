import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinanceExpensesPage() {
  return (
    <ModulePlaceholderPage
      description="רישום ומעקב אחר הוצאות הארגון לפי קטגוריה."
      capabilities={[
        'רישום הוצאות לפי קטגוריה',
        'אישור הוצאות בתהליך עבודה',
        'שיוך לתקציב',
        'דוחות הוצאה תקופתיים',
      ]}
    />
  );
}
