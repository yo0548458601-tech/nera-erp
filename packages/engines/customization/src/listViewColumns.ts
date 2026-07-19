/**
 * Configurable list-view column architecture: which columns a given list
 * screen (e.g. the Contacts list) shows, in which order, by default - and
 * how an administrator's system/institution/role default cascades down to
 * an individual user's own preference. This mirrors the precedence model
 * already used by @nera/authorization-engine's resolveEffectivePermission
 * (user -> role -> institution -> system -> built-in default), reused here
 * because it is the same underlying platform concept - a tenant-scoped
 * configuration cascade - applied to a different kind of setting (see
 * ARCHITECTURE.md's Customization Engine section: "Configuration should be
 * tenant-scoped unless explicitly defined as global").
 */
export type ListColumnSource = 'built_in' | 'custom_field';

/** One column a list screen COULD show - the catalog a chooser UI picks from. Built by the app layer (built-in fields) plus, for custom fields, generated from CustomFieldDefinition[]. */
export type ListColumnDefinition = {
  key: string;
  hebrewHeader: string;
  source: ListColumnSource;
  defaultVisible: boolean;
  defaultOrder: number;
  /** A required column (e.g. the primary name/identity column) can never be hidden by any preference. */
  required?: boolean;
  width?: number;
};

export type ListViewPreferenceScope = 'system' | 'institution' | 'role' | 'user';

/**
 * One saved column preference at one scope, for one screen. The order of
 * `visibleColumnKeys` IS the column display order - a hidden column simply
 * does not appear in this array.
 */
export type ListViewColumnPreference = {
  id: string;
  scope: ListViewPreferenceScope;
  /** A role id for 'role' scope, an institution id for 'institution' scope, a user id for 'user' scope; undefined for 'system' scope. */
  targetId?: string;
  screenId: string;
  visibleColumnKeys: string[];
  updatedAt: string;
  updatedByUserId?: string;
};

export type ListViewPreferenceContext = {
  userId: string;
  roleIds: string[];
  institutionId?: string;
};

export type EffectiveListViewColumns = {
  screenId: string;
  visibleColumnKeys: string[];
  source: ListViewPreferenceScope | 'default';
};

/**
 * Resolves the effective visible/ordered column list for one screen +
 * context, using the same most-specific-wins precedence as permission
 * resolution: user preference -> role default -> institution default ->
 * system default -> the screen's own built-in default. This is a
 * client-side demo resolver - not a security boundary and not yet backed
 * by a real server; see AuthorizationContext's docstring for the same
 * caveat applied to permissions.
 */
export function resolveEffectiveListViewColumns(
  screenId: string,
  context: ListViewPreferenceContext,
  rules: ListViewColumnPreference[],
  builtInDefaultColumnKeys: string[]
): EffectiveListViewColumns {
  const forScreen = rules.filter(rule => rule.screenId === screenId);

  const userRule = forScreen.find(
    rule => rule.scope === 'user' && rule.targetId === context.userId
  );
  if (userRule) {
    return { screenId, visibleColumnKeys: userRule.visibleColumnKeys, source: 'user' };
  }

  const roleRule = forScreen.find(
    rule =>
      rule.scope === 'role' &&
      rule.targetId !== undefined &&
      context.roleIds.includes(rule.targetId)
  );
  if (roleRule) {
    return { screenId, visibleColumnKeys: roleRule.visibleColumnKeys, source: 'role' };
  }

  const institutionRule = forScreen.find(
    rule => rule.scope === 'institution' && rule.targetId === context.institutionId
  );
  if (institutionRule) {
    return {
      screenId,
      visibleColumnKeys: institutionRule.visibleColumnKeys,
      source: 'institution',
    };
  }

  const systemRule = forScreen.find(rule => rule.scope === 'system');
  if (systemRule) {
    return { screenId, visibleColumnKeys: systemRule.visibleColumnKeys, source: 'system' };
  }

  return { screenId, visibleColumnKeys: builtInDefaultColumnKeys, source: 'default' };
}

/** The screen's built-in default: required columns first (always visible), then whichever optional columns are marked defaultVisible, in defaultOrder. */
export function getBuiltInDefaultColumnKeys(definitions: ListColumnDefinition[]): string[] {
  return [...definitions]
    .filter(definition => definition.required || definition.defaultVisible)
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map(definition => definition.key);
}
