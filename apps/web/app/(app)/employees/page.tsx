import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function EmployeesPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול כרטיסי עובדים, תפקידים ומידע ארגוני."
      capabilities={['כרטיס עובד', 'תפקידים ומחלקות', 'נוכחות וחופשות', 'מסמכים אישיים', 'היסטוריית העסקה']}
    />
  );
}
