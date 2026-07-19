import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function ReportsPage() {
  return (
    <ModulePlaceholderPage
      description="דוחות ניהוליים ותצוגות מותאמות על נתוני הארגון."
      capabilities={[
        'דוחות מוכנים מראש',
        'בניית דוח מותאם אישית',
        'ייצוא לאקסל ול-PDF',
        'תזמון הפצת דוחות',
      ]}
    />
  );
}
