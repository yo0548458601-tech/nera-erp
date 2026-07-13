import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function FinanceClearingPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול סליקת כרטיסי אשראי ואמצעי תשלום דיגיטליים."
      capabilities={['חיבור לספקי סליקה', 'מעקב עסקאות', 'זיכויים וביטולים', 'התאמה מול חשבוניות']}
    />
  );
}
