'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getBillingProfileForRoleAssignment, type BillingProfile } from '@nera/entity-engine';

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type BillingProfileContextValue = {
  billingProfiles: BillingProfile[];
  getBillingProfile: (roleAssignmentId: string) => BillingProfile | undefined;
  setBillingDisplayName: (roleAssignmentId: string, entityId: string, billingDisplayName: string) => void;
};

const BillingProfileContext = createContext<BillingProfileContextValue | undefined>(undefined);

/**
 * Holds "שם לחשבונית" (billing/invoice display name) records, keyed by
 * roleAssignmentId - never by entityId - so the same entity can carry a
 * different billing name per role (e.g. a different name as a supplier
 * than as a donor), matching the platform's role-specific-separation rule
 * (see billingProfile.ts). Demo-only, in-memory.
 */
export function BillingProfileProvider({ children }: { children: ReactNode }) {
  const [billingProfiles, setBillingProfiles] = useState<BillingProfile[]>([]);

  const getBillingProfile = useCallback(
    (roleAssignmentId: string) => getBillingProfileForRoleAssignment(billingProfiles, roleAssignmentId),
    [billingProfiles],
  );

  const setBillingDisplayName = useCallback((roleAssignmentId: string, entityId: string, billingDisplayName: string) => {
    setBillingProfiles((current) => {
      const existing = current.find((profile) => profile.roleAssignmentId === roleAssignmentId);
      const now = new Date().toISOString();
      if (existing) {
        return current.map((profile) => (profile.id === existing.id ? { ...profile, billingDisplayName, updatedAt: now } : profile));
      }
      return [...current, { id: createId('billing'), roleAssignmentId, entityId, billingDisplayName, createdAt: now, updatedAt: now }];
    });
  }, []);

  const value = useMemo<BillingProfileContextValue>(
    () => ({ billingProfiles, getBillingProfile, setBillingDisplayName }),
    [billingProfiles, getBillingProfile, setBillingDisplayName],
  );

  return <BillingProfileContext.Provider value={value}>{children}</BillingProfileContext.Provider>;
}

export function useBillingProfiles(): BillingProfileContextValue {
  const context = useContext(BillingProfileContext);
  if (!context) {
    throw new Error('useBillingProfiles must be used within a BillingProfileProvider');
  }
  return context;
}
