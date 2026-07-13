import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function ContactsPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול אנשי קשר, גורמים חיצוניים ופרטי התקשרות כלליים."
      capabilities={['כרטיס איש קשר', 'שיוך לארגונים וגורמים', 'היסטוריית תקשורת', 'תיוג וסיווג אנשי קשר', 'ייבוא וייצוא רשימות']}
    />
  );
}
