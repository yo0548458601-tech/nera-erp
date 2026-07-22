import { cookies } from 'next/headers';
import { listEntitiesAction } from '@/src/lib/actions/entityActions';
import { EntityProvider } from '@/src/context/EntityContext';
import { PersonDetailPageClient } from './PersonDetailPageClient';

/**
 * Server Component (P013A - same pattern as `contacts/page.tsx`; see that
 * file and the implementation report for the full Server Component read
 * analysis). Reuses `listEntitiesAction` (fetches the whole organization's
 * entities, same as the list page) rather than a dedicated by-id read -
 * consistent with the list page's own data shape and avoids a second,
 * differently-shaped fetch path; not the most efficient possible query, but
 * correct and simple.
 */
export default async function PersonDetailPage({ params }: { params: { id: string } }) {
  const organizationId = cookies().get('nera_selected_org_id')?.value;

  if (!organizationId) {
    return (
      <EntityProvider initialEntities={[]} initialRoleAssignments={[]} initialNotes={[]}>
        <PersonDetailPageClient entityId={params.id} />
      </EntityProvider>
    );
  }

  const result = await listEntitiesAction(organizationId);
  const initialEntities = result.ok ? result.data.entities : [];
  const initialRoleAssignments = result.ok ? result.data.roleAssignments : [];
  const initialNotes = result.ok ? result.data.notes : [];

  return (
    <EntityProvider
      initialEntities={initialEntities}
      initialRoleAssignments={initialRoleAssignments}
      initialNotes={initialNotes}
    >
      <PersonDetailPageClient entityId={params.id} />
    </EntityProvider>
  );
}
