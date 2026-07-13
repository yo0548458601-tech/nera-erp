import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinanceTuitionPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול חיובי שכר לימוד, הנחות ומעקב יתרות."
      capabilities={['חיובי שכר לימוד לפי תלמיד', 'הנחות ומלגות', 'מעקב יתרות פתוחות', 'תזכורות תשלום']}
    />
  );
}
