'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/src/context/SessionContext';
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

  return <AppShell>{children}</AppShell>;
}
