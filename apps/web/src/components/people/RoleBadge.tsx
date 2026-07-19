'use client';

import { type EntityRoleId, getRoleLabel } from '@nera/entity-engine';
import { useRoleDefinitions } from '../../context/RoleDefinitionContext';

type RoleBadgeProps = {
  role: EntityRoleId;
  onRemove?: () => void;
};

export function RoleBadge({ role, onRemove }: RoleBadgeProps) {
  const { roles } = useRoleDefinitions();
  const label = getRoleLabel(roles, role);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`הסר תפקיד ${label}`}
          className="rounded-full text-cyan-500 hover:text-cyan-800"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
