'use client';

import { InteractiveShell } from './InteractiveShell';
import { type AuthSession } from '../lib/auth/demoAuth';

type PlatformShellProps = {
  session: AuthSession;
  onLogout: () => void;
  onOrganizationChange: (organizationId: string) => void;
};

export function PlatformShell({ session, onLogout, onOrganizationChange }: PlatformShellProps) {
  return <InteractiveShell session={session} onLogout={onLogout} onOrganizationChange={onOrganizationChange} />;
}
