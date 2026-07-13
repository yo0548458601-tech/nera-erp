import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function SettingsPage() {
  return (
    <ModulePlaceholderPage
      description="הגדרות כלליות של הארגון והמערכת."
      capabilities={['פרטי ארגון', 'העדפות תצוגה ושפה', 'ניהול מודולים פעילים', 'הגדרות אבטחה']}
    />
  );
}
