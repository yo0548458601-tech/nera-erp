import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function NotificationsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול התראות מערכת והעדפות קבלה."
      capabilities={['מרכז התראות מלא', 'העדפות קבלה לפי ערוץ', 'סינון וארכוב', 'התראות לפי תפקיד']}
    />
  );
}
