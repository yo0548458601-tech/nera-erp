import { PageHeader } from './PageHeader';
import { ComingSoonState } from './ComingSoonState';

type ModulePlaceholderPageProps = {
  description: string;
  capabilities: string[];
};

/**
 * Shared page body for modules that don't have real functionality yet.
 * Title and breadcrumbs are resolved automatically by PageHeader from the
 * current route, so each route only supplies its description and planned
 * capabilities - no markup duplication across placeholder routes.
 */
export function ModulePlaceholderPage({ description, capabilities }: ModulePlaceholderPageProps) {
  return (
    <>
      <PageHeader subtitle={description} />
      <ComingSoonState capabilities={capabilities} />
    </>
  );
}
