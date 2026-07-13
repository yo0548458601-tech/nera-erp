import { demoOrganizations, demoPermissions, demoUser } from './demoData';

export type AuthSession = {
  user: typeof demoUser;
  organizations: typeof demoOrganizations;
  selectedOrganizationId: string;
  isDemo: boolean;
};

export function isDemoModeEnabled() {
  const rawValue = process.env.NERA_DEMO_MODE;
  return rawValue === 'true' || rawValue === '1' || rawValue === 'TRUE';
}

export function createDemoSession() {
  return {
    user: demoUser,
    organizations: demoOrganizations,
    selectedOrganizationId: demoOrganizations[0].id,
    isDemo: true,
  } satisfies AuthSession;
}

export function getDemoSessionSnapshot() {
  if (!isDemoModeEnabled()) {
    return null;
  }

  return createDemoSession();
}

export function getDemoPermissionHints() {
  return demoPermissions;
}
