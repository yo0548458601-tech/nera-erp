import { PageHeader } from '@/src/components/shell/PageHeader';
import { DocumentsVerificationPanel } from '@/src/components/documents/DocumentsVerificationPanel';

export default function DocumentsPage() {
  return (
    <>
      <PageHeader subtitle="העלאה, הורדה ומחיקה של מסמכים (P014 - מסך אימות)." />

      <div className="flex flex-col gap-6">
        <DocumentsVerificationPanel />
      </div>
    </>
  );
}
