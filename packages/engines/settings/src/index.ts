export type SettingScope = 'tenant' | 'organization' | 'user';

export type SettingDefinition = {
  key: string;
  scope: SettingScope;
  defaultValue: string | boolean | number;
  description: string;
};

export type RuntimeSetting = SettingDefinition & {
  value: string | boolean | number;
};

export const defaultSettings: SettingDefinition[] = [
  {
    key: 'calendar.system',
    scope: 'tenant',
    defaultValue: 'gregorian',
    description: 'Default calendar system for display',
  },
  {
    key: 'ui.language',
    scope: 'tenant',
    defaultValue: 'he-IL',
    description: 'Default UI language',
  },
  {
    key: 'ui.direction',
    scope: 'tenant',
    defaultValue: 'rtl',
    description: 'Default UI direction',
  },
];

export function resolveSetting(
  settings: Partial<Record<string, RuntimeSetting>>,
  key: string
): RuntimeSetting | undefined {
  return settings[key];
}

export function createSettingValue(
  definition: SettingDefinition,
  value: string | boolean | number
): RuntimeSetting {
  return {
    ...definition,
    value,
  };
}
