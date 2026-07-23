import { cookies } from 'next/headers';
import { listEntitiesAction } from '@/src/lib/actions/entityActions';
import { EntityProvider } from '@/src/context/EntityContext';
import { SELECTED_ORG_COOKIE_NAME } from '@/src/lib/auth/demoIdentity';
import { ContactsPageClient } from './ContactsPageClient';

/**
 * Server Component (P013A - Owner-reviewed resolution to the Server
 * Component read blocker; see the implementation report for the full
 * analysis). Reads the selected organization from a cookie
 * (`SessionContext.tsx` writes it - `sessionStorage` alone is invisible to
 * the server) and fetches real data directly via `listEntitiesAction`
 * (a plain async function; still not a Route Handler), then mounts a
 * *nested* `EntityProvider`, pre-seeded with that data, around the
 * interactive client component. This nested provider shadows the
 * app-shell-level one from `(app)/layout.tsx` for everything rendered
 * inside it - `ContactsPageClient` and its children need no changes to
 * pick this up, since React context always resolves to the nearest
 * ancestor Provider.
 *
 * If no organization is selected yet (no session), renders with empty
 * initial data - `(app)/layout.tsx`'s own client-side session check
 * redirects away almost immediately in that case.
 */
export default async function ContactsPage() {
  const organizationId = cookies().get(SELECTED_ORG_COOKIE_NAME)?.value;

  if (!organizationId) {
    return (
      <EntityProvider initialEntities={[]} initialRoleAssignments={[]} initialNotes={[]}>
        <ContactsPageClient />
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
      <ContactsPageClient />
    </EntityProvider>
  );
}
