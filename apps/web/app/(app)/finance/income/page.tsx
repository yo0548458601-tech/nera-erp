import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinanceIncomePage() {
  return (
    <ModulePlaceholderPage
      description="מעקב אחר מקורות הכנסה ותנועות כספיות נכנסות."
      capabilities={[
        'רישום מקורות הכנסה',
        'שיוך לתקציב ולמחלקה',
        'דוחות הכנסה תקופתיים',
        'התאמה מול תשלומים בפועל',
      ]}
    />
  );
}
