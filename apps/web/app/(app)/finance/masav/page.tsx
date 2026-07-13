import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinanceMasavPage() {
  return (
    <ModulePlaceholderPage
      description='הפקת קבצי מס"ב וניהול העברות בנקאיות מרוכזות.'
      capabilities={['הפקת קובץ מס"ב', 'ניהול הרשאות תשלום', 'מעקב סטטוס העברה', 'היסטוריית קבצים']}
    />
  );
}
