import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function TasksPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול משימות צוותיות ומעקב אחר סטטוס ביצוע."
      capabilities={['יצירת משימה', 'שיוך לאחראי ולתאריך יעד', 'מעקב סטטוס', 'תזכורות']}
    />
  );
}
