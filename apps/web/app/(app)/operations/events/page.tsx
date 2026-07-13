import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function EventsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול לוח אירועים ארגוני ומעקב השתתפות."
      capabilities={['יצירת אירוע', 'ניהול משתתפים', 'תזכורות', 'שיוך למחלקה או לארגון']}
    />
  );
}
