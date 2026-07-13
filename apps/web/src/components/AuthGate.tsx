'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { demoOrganizations } from '../lib/auth/demoData';
import { useSession } from '../context/SessionContext';
import { LoginScreen } from './LoginScreen';

export function AuthGate() {
  const router = useRouter();
  const { demoModeEnabled, session, isHydrated, login, loginAsDemo, selectOrganization, logout } = useSession();
  const [view, setView] = useState<'login' | 'org-select'>('login');
  const hasCheckedInitialSession = useRef(false);

  // Only redirect for a session restored from storage on the very first
  // hydration check - not for a session created moments later by an
  // interactive login, which should go through the org-select step below.
  useEffect(() => {
    if (!isHydrated || hasCheckedInitialSession.current) {
      return;
    }
    hasCheckedInitialSession.current = true;
    if (session) {
      router.replace('/dashboard');
    }
  }, [isHydrated, session, router]);

  const proceedAfterLogin = () => {
    if (demoOrganizations.length > 1) {
      setView('org-select');
    } else {
      router.push('/dashboard');
    }
  };

  const handleLogin = (email: string, password: string) => {
    const result = login(email, password);
    if (result.success) {
      proceedAfterLogin();
    }
    return result;
  };

  const handleDemoLogin = () => {
    loginAsDemo();
    proceedAfterLogin();
  };

  const handleLogout = () => {
    logout();
    setView('login');
  };

  const handleOrganizationSelect = (organizationId: string) => {
    selectOrganization(organizationId);
    router.push('/dashboard');
  };

  if (!isHydrated) {
    return null;
  }

  if (!demoModeEnabled) {
    return <LoginScreen onLogin={handleLogin} demoModeEnabled={false} />;
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} onDemoLogin={handleDemoLogin} demoModeEnabled />;
  }

  if (view === 'org-select') {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-[32px] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <div>
            <p className="text-sm font-medium text-cyan-300">מצב הדגמה</p>
            <h1 className="mt-2 text-3xl font-semibold">בחר ארגון</h1>
            <p className="mt-2 text-sm text-slate-300">המערכת תציג את הארגון שנבחר בהמשך כל חוויית השימוש.</p>
          </div>
          <div className="grid gap-3">
            {session.organizations.map((organization) => (
              <button
                key={organization.id}
                type="button"
                onClick={() => handleOrganizationSelect(organization.id)}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-4 text-right text-sm font-medium text-white"
              >
                {organization.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleLogout} className="self-start text-sm text-slate-300 underline">
            יציאה
          </button>
        </div>
      </div>
    );
  }

  return null;
}
