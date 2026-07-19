import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function VendorsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול ספקים, סניפים, חשבוניות ותשלומים."
      capabilities={[
        'כרטיס ספק',
        'סניפים ואנשי קשר',
        'חשבוניות',
        'תשלומים',
        'שיוך למוסדות',
        'בקרת כפילויות',
      ]}
    />
  );
}
