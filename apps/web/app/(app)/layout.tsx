'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/src/context/SessionContext';
import { EntityProvider } from '@/src/context/EntityContext';
import { AuthorizationProvider } from '@/src/context/AuthorizationContext';
import { RoleDefinitionProvider } from '@/src/context/RoleDefinitionContext';
import { CustomFieldProvider } from '@/src/context/CustomFieldContext';
import { BillingProfileProvider } from '@/src/context/BillingProfileContext';
import { ListViewPreferenceProvider } from '@/src/context/ListViewPreferenceContext';
import { FieldRequirementProvider } from '@/src/context/FieldRequirementContext';
import { AppShell } from '@/src/components/shell/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, isHydrated } = useSession();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isHydrated && !session && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/');
    }
  }, [isHydrated, session, router]);

  if (!isHydrated || !session) {
    return null;
  }

  return (
    <AuthorizationProvider>
      <RoleDefinitionProvider>
        <CustomFieldProvider>
          <BillingProfileProvider>
            <ListViewPreferenceProvider>
              <FieldRequirementProvider>
                <EntityProvider>
                  <AppShell>{children}</AppShell>
                </EntityProvider>
              </FieldRequirementProvider>
            </ListViewPreferenceProvider>
          </BillingProfileProvider>
        </CustomFieldProvider>
      </RoleDefinitionProvider>
    </AuthorizationProvider>
  );
}
