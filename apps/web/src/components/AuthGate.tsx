'use client';

import { useState } from 'react';
import { createDemoSession } from '../lib/auth/demoAuth';
import { LoginScreen } from './LoginScreen';
import { PlatformShell } from './PlatformShell';

type AuthGateProps = {
  demoModeEnabled: boolean;
};

export function AuthGate({ demoModeEnabled }: AuthGateProps) {
  const [session, setSession] = useState<ReturnType<typeof createDemoSession> | null>(null);
  const [view, setView] = useState<'login' | 'org-select' | 'app'>('login');

  const handleLogin = (email: string, password: string) => {
    if (!demoModeEnabled) {
      return { success: false, message: 'התחברות לא זמינה אלא במצב הדגמה' };
    }

    if (!email || !password) {
      return { success: false, message: 'יש למלא את כל השדות' };
    }

    const nextSession = createDemoSession();
    setSession(nextSession);
    setView(nextSession.organizations.length > 1 ? 'org-select' : 'app');
    return { success: true, message: 'התחברת בהצלחה למצב הדגמה' };
  };

  const handleDemoLogin = () => {
    const nextSession = createDemoSession();
    setSession(nextSession);
    setView(nextSession.organizations.length > 1 ? 'org-select' : 'app');
  };

  const handleLogout = () => {
    setSession(null);
    setView('login');
  };

  const handleOrganizationSelect = (organizationId: string) => {
    setSession(current => (current ? { ...current, selectedOrganizationId: organizationId } : current));
    setView('app');
  };

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

  return <PlatformShell session={session} onLogout={handleLogout} onOrganizationChange={handleOrganizationSelect} />;
}
