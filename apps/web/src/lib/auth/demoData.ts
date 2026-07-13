export type DemoOrganization = {
  id: string;
  name: string;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const demoUser: DemoUser = {
  id: 'demo-user',
  name: 'מנהל מערכת',
  email: 'demo@nera.local',
  role: 'מנהל מערכת',
};

export const demoOrganizations: DemoOrganization[] = [
  { id: 'org-main', name: 'ארגון ראשי' },
  { id: 'org-jerusalem', name: 'מוסד ירושלים' },
  { id: 'org-bnei-brak', name: 'סניף בני ברק' },
];

export const demoPermissions = ['read:dashboard', 'write:settings'];
