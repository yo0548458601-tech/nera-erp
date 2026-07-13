import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function AuditLogPage() {
  return (
    <ModulePlaceholderPage
      description="תיעוד פעולות משתמשים ואירועי מערכת."
      capabilities={['יומן פעולות מלא', 'סינון לפי משתמש או פעולה', 'תיעוד ערכים קודמים וחדשים', 'ייצוא ליומן חיצוני']}
    />
  );
}
