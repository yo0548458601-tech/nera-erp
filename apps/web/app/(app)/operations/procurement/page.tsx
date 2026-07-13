import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function ProcurementPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול תהליכי רכש ובקשות רכש ארגוניות."
      capabilities={['בקשת רכש', 'תהליך אישור רכש', 'שיוך לתקציב', 'מעקב סטטוס בקשה']}
    />
  );
}
