import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function StudentsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול תלמידים, מסגרות לימוד, אנשי קשר, חיובים ומעקב שכר לימוד."
      capabilities={['כרטיס תלמיד', 'שיוך למוסד ולמסגרת', 'הורים ואנשי קשר', 'חיובי שכר לימוד', 'הנחות ומלגות', 'סליקה ומעקב יתרות']}
    />
  );
}
