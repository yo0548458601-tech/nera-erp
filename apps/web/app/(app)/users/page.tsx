import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function UsersPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול משתמשים, תפקידים והרשאות גישה."
      capabilities={['ניהול משתמשים', 'תפקידים והרשאות', 'הרשאות ברמת רשומה', 'היסטוריית התחברות']}
    />
  );
}
