'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createDemoSession, type AuthSession } from '../lib/auth/demoAuth';

const SESSION_STORAGE_KEY = 'nera:demo-session';

type LoginResult = { success: boolean; message: string };

type SessionContextValue = {
  demoModeEnabled: boolean;
  session: AuthSession | null;
  /** True once the client has attempted to restore a persisted session. */
  isHydrated: boolean;
  login: (email: string, password: string) => LoginResult;
  loginAsDemo: () => void;
  selectOrganization: (organizationId: string) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null) {
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // sessionStorage may be unavailable (private mode, disabled storage).
    // The demo session then simply lives in memory for the current page load.
  }
}

type SessionProviderProps = {
  demoModeEnabled: boolean;
  children: ReactNode;
};

/**
 * Holds the demo session (user + organizations + selected organization) in a
 * single place so route changes don't reset organization context and pages
 * don't need to prop-drill session data. Persisted to sessionStorage (not
 * localStorage) so a refresh survives within the tab but the fake demo
 * session doesn't outlive the browser session - this is a demo convenience,
 * not a real authentication mechanism.
 */
export function SessionProvider({ demoModeEnabled, children }: SessionProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSession(readStoredSession());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      writeStoredSession(session);
    }
  }, [session, isHydrated]);

  const login = useCallback(
    (email: string, password: string): LoginResult => {
      if (!demoModeEnabled) {
        return { success: false, message: 'התחברות לא זמינה אלא במצב הדגמה' };
      }
      if (!email || !password) {
        return { success: false, message: 'יש למלא את כל השדות' };
      }
      setSession(createDemoSession());
      return { success: true, message: 'התחברת בהצלחה למצב הדגמה' };
    },
    [demoModeEnabled]
  );

  const loginAsDemo = useCallback(() => {
    setSession(createDemoSession());
  }, []);

  const selectOrganization = useCallback((organizationId: string) => {
    setSession(current =>
      current ? { ...current, selectedOrganizationId: organizationId } : current
    );
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      demoModeEnabled,
      session,
      isHydrated,
      login,
      loginAsDemo,
      selectOrganization,
      logout,
    }),
    [demoModeEnabled, session, isHydrated, login, loginAsDemo, selectOrganization, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
