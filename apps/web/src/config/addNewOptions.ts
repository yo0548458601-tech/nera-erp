'use client';

import { useMemo } from 'react';
import { type EntityRoleId } from '@nera/entity-engine';
import { useRoleDefinitions } from '../context/RoleDefinitionContext';

export type AddNewOption = {
  id: string;
  /** Hebrew label shown in the global "Add New" surface. */
  label: string;
  entityType: 'person' | 'organization';
  /** Preselected role when this shortcut opens the person dialog directly. */
  presetRole?: EntityRoleId;
  /**
   * Whether this option is wired to a real creation flow yet. Options that
   * are not implemented are shown disabled, never as a fake-working
   * button - the global Add New model must support these future choices
   * without ever being misleading about what currently works.
   */
  implemented: boolean;
};

/**
 * The global "Add New" action is driven by the live, administrator
 * configurable role catalog (RoleDefinitionContext) rather than a
 * hardcoded duplicate option array: any role definition with
 * showInGlobalAddNew=true automatically becomes a shortcut here, without a
 * second place needing to register it. A role only gets a real, working
 * shortcut when it targets 'person' (the only entity type with an
 * implemented creation form this sprint) - a role that also or only
 * targets 'organization' (e.g. "ספק") is still listed, but disabled with a
 * "בפיתוח" label, matching the rule that an action must never look like it
 * works when no creation flow exists for it yet.
 */
export function useAddNewOptions(): AddNewOption[] {
  const { roles } = useRoleDefinitions();

  return useMemo(() => {
    const base: AddNewOption[] = [
      { id: 'person', label: 'אדם חדש', entityType: 'person', implemented: true },
      { id: 'organization', label: 'חברה או ארגון חדש', entityType: 'organization', implemented: false },
    ];

    const roleOptions: AddNewOption[] = roles
      .filter((role) => role.showInGlobalAddNew && role.status === 'active' && !role.deletedAt)
      .sort((a, b) => a.order - b.order)
      .map((role) => {
        const targetsPerson = role.applicableEntityTypes.includes('person');
        return {
          id: `role-${role.key}`,
          label: role.label,
          entityType: targetsPerson ? 'person' : 'organization',
          presetRole: role.key,
          implemented: targetsPerson,
        };
      });

    return [...base, ...roleOptions];
  }, [roles]);
}
