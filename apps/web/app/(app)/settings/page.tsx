import { PageHeader } from '@/src/components/shell/PageHeader';
import { ComingSoonState } from '@/src/components/shell/ComingSoonState';
import { UserPermissionsPanel } from '@/src/components/settings/UserPermissionsPanel';
import { RoleDefinitionsPanel } from '@/src/components/settings/RoleDefinitionsPanel';
import { CustomFieldsPanel } from '@/src/components/settings/CustomFieldsPanel';
import { ListViewDefaultsPanel } from '@/src/components/settings/ListViewDefaultsPanel';
import { FieldRequirementsPanel } from '@/src/components/settings/FieldRequirementsPanel';
import { AddressProviderPanel } from '@/src/components/settings/AddressProviderPanel';

export default function SettingsPage() {
  return (
    <>
      <PageHeader subtitle="הגדרות כלליות של הארגון והמערכת." />

      <div className="flex flex-col gap-6">
        <UserPermissionsPanel />
        <RoleDefinitionsPanel />
        <CustomFieldsPanel />
        <ListViewDefaultsPanel />
        <FieldRequirementsPanel />
        <AddressProviderPanel />
        <ComingSoonState
          capabilities={[
            'פרטי ארגון',
            'העדפות תצוגה ושפה',
            'ניהול מודולים פעילים',
            'הגדרות אבטחה נוספות',
          ]}
        />
      </div>
    </>
  );
}
