import { demoPermissions, demoUser, persistedDemoOrganizations } from './demoData';

export type AuthSession = {
  user: typeof demoUser;
  organizations: typeof persistedDemoOrganizations;
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
    organizations: persistedDemoOrganizations,
    selectedOrganizationId: persistedDemoOrganizations[0].id,
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
