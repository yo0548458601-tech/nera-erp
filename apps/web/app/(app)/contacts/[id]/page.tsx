'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, Blocks, Pencil } from 'lucide-react';
import { getPersonFullName } from '@nera/entity-engine';
import { useEntities } from '@/src/context/EntityContext';
import { useMyPermission } from '@/src/context/AuthorizationContext';
import { PageHeader } from '@/src/components/shell/PageHeader';
import { EmptyState } from '@/src/components/shell/EmptyState';
import { PersonOverviewCard } from '@/src/components/people/PersonOverviewCard';
import { PersonContactMethodsCard } from '@/src/components/people/PersonContactMethodsCard';
import { PersonRolesCard } from '@/src/components/people/PersonRolesCard';
import { PersonNotesCard } from '@/src/components/people/PersonNotesCard';
import { PersonHistoryCard } from '@/src/components/people/PersonHistoryCard';
import { PersonCustomFieldsCard } from '@/src/components/people/PersonCustomFieldsCard';
import { PersonFormDialog } from '@/src/components/people/PersonFormDialog';

export default function PersonDetailPage({ params }: { params: { id: string } }) {
  const { getEntityById, getHistoryForEntity } = useEntities();
  const canEditEntity = useMyPermission('entities.edit');
  const person = getEntityById(params.id);
  const [editOpen, setEditOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const editTriggerRef = useRef<HTMLButtonElement>(null);

  if (!person) {
    return (
      <>
        <PageHeader breadcrumbExtra="איש קשר לא נמצא" />
        <EmptyState
          title="איש הקשר לא נמצא"
          description="ייתכן שהרשומה נמחקה או שהקישור שגוי."
          action={
            <Link href="/contacts" className="text-sm font-medium text-cyan-700 hover:underline">
              חזרה לרשימת אנשי הקשר
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbExtra={getPersonFullName(person.profile)}
        subtitle="כרטיס איש קשר מלא"
        primaryAction={
          canEditEntity ? (
            <button
              ref={editTriggerRef}
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Pencil size={16} aria-hidden="true" />
              עריכת איש קשר
            </button>
          ) : undefined
        }
      />

      {successMessage ? (
        <div role="status" className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <PersonOverviewCard person={person} />
        <PersonRolesCard person={person} />
        <PersonContactMethodsCard person={person} />
        <PersonNotesCard person={person} />
        <PersonCustomFieldsCard person={person} />
        <PersonHistoryCard history={getHistoryForEntity(person.id)} />

        <div className="grid gap-6 sm:grid-cols-2">
          <EmptyState
            icon={Activity}
            title="פעילות"
            description="יומן פעילות מלא יתווסף בעתיד עם חיבור למנוע האירועים והביקורת."
          />
          <EmptyState
            icon={Blocks}
            title="מודולים עתידיים"
            description="נתוני מודולים ייעודיים (ספקים, אברכים, תלמידים ועוד) יוצגו כאן בהתאם לתפקידים המשויכים לאיש הקשר."
          />
        </div>
      </div>

      <PersonFormDialog
        open={editOpen}
        mode="edit"
        person={person}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setSuccessMessage('הפרטים עודכנו בהצלחה.');
          window.setTimeout(() => setSuccessMessage(''), 3000);
        }}
        restoreFocusRef={editTriggerRef}
      />
    </>
  );
}
