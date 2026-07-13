export type NavIconId =
  | 'dashboard'
  | 'contacts'
  | 'vendors'
  | 'avreichim'
  | 'students'
  | 'employees'
  | 'income'
  | 'expenses'
  | 'invoices'
  | 'payments'
  | 'tuition'
  | 'clearing'
  | 'masav'
  | 'procurement'
  | 'purchase-orders'
  | 'inventory'
  | 'assets'
  | 'tasks'
  | 'events'
  | 'forms'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'users'
  | 'audit-log';

export type NavItem = {
  /** Stable English identifier, used for keys and lookups. */
  id: string;
  /** Hebrew label shown in the UI. */
  label: string;
  /** Absolute app route this item links to. */
  href: string;
  icon: NavIconId;
  badge?: string | number;
  children?: NavItem[];
  requiredPermission?: string;
  featureFlag?: string;
  /** Short Hebrew description, used on placeholder pages and tooltips. */
  description?: string;
  order?: number;
};

export type NavSectionId = 'main' | 'finance' | 'operations' | 'system';

export type NavSection = {
  id: NavSectionId;
  /** Hebrew section label shown as a sidebar group header. */
  label: string;
  items: NavItem[];
  order?: number;
};

export type BreadcrumbEntry = {
  label: string;
  href?: string;
};

export const navigationSections: NavSection[] = [
  {
    id: 'main',
    label: 'ראשי',
    order: 1,
    items: [
      {
        id: 'dashboard',
        label: 'לוח בקרה',
        href: '/dashboard',
        icon: 'dashboard',
        description: 'תמונת מצב כללית על הארגון: הכנסות, משימות ואירועים קרובים.',
        order: 1,
      },
      {
        id: 'contacts',
        label: 'אנשי קשר',
        href: '/contacts',
        icon: 'contacts',
        description: 'ניהול אנשי קשר, גורמים חיצוניים ופרטי התקשרות כלליים.',
        order: 2,
      },
      {
        id: 'vendors',
        label: 'ספקים',
        href: '/vendors',
        icon: 'vendors',
        description: 'ניהול ספקים, סניפים, חשבוניות ותשלומים.',
        order: 3,
      },
      {
        id: 'avreichim',
        label: 'אברכים',
        href: '/avreichim',
        icon: 'avreichim',
        description: 'ניהול כרטיסי אברכים, שיוך למוסדות ומעקב מלגות.',
        order: 4,
      },
      {
        id: 'students',
        label: 'תלמידים',
        href: '/students',
        icon: 'students',
        description: 'ניהול תלמידים, מסגרות לימוד, אנשי קשר, חיובים ומעקב שכר לימוד.',
        order: 5,
      },
      {
        id: 'employees',
        label: 'עובדים',
        href: '/employees',
        icon: 'employees',
        description: 'ניהול כרטיסי עובדים, תפקידים ומידע ארגוני.',
        order: 6,
      },
    ],
  },
  {
    id: 'finance',
    label: 'כספים',
    order: 2,
    items: [
      {
        id: 'finance-income',
        label: 'הכנסות',
        href: '/finance/income',
        icon: 'income',
        description: 'מעקב אחר מקורות הכנסה ותנועות כספיות נכנסות.',
        order: 1,
      },
      {
        id: 'finance-expenses',
        label: 'הוצאות',
        href: '/finance/expenses',
        icon: 'expenses',
        description: 'רישום ומעקב אחר הוצאות הארגון לפי קטגוריה.',
        order: 2,
      },
      {
        id: 'finance-invoices',
        label: 'חשבוניות',
        href: '/finance/invoices',
        icon: 'invoices',
        description: 'הפקה, ניהול ומעקב אחר חשבוניות.',
        order: 3,
      },
      {
        id: 'finance-payments',
        label: 'תשלומים',
        href: '/finance/payments',
        icon: 'payments',
        description: 'ניהול תשלומים יוצאים ומעקב סטטוס תשלום.',
        order: 4,
      },
      {
        id: 'finance-tuition',
        label: 'שכר לימוד',
        href: '/finance/tuition',
        icon: 'tuition',
        description: 'ניהול חיובי שכר לימוד, הנחות ומעקב יתרות.',
        order: 5,
      },
      {
        id: 'finance-clearing',
        label: 'סליקה',
        href: '/finance/clearing',
        icon: 'clearing',
        description: 'ניהול סליקת כרטיסי אשראי ואמצעי תשלום דיגיטליים.',
        order: 6,
      },
      {
        id: 'finance-masav',
        label: 'מס"ב',
        href: '/finance/masav',
        icon: 'masav',
        description: 'הפקת קבצי מס"ב וניהול העברות בנקאיות מרוכזות.',
        order: 7,
      },
    ],
  },
  {
    id: 'operations',
    label: 'תפעול',
    order: 3,
    items: [
      {
        id: 'operations-procurement',
        label: 'רכש',
        href: '/operations/procurement',
        icon: 'procurement',
        description: 'ניהול תהליכי רכש ובקשות רכש ארגוניות.',
        order: 1,
      },
      {
        id: 'operations-purchase-orders',
        label: 'הזמנות רכש',
        href: '/operations/purchase-orders',
        icon: 'purchase-orders',
        description: 'יצירה ומעקב אחר הזמנות רכש מול ספקים.',
        order: 2,
      },
      {
        id: 'operations-inventory',
        label: 'מלאי',
        href: '/operations/inventory',
        icon: 'inventory',
        description: 'ניהול מלאי, מוצרים ומעקב זמינות.',
        order: 3,
      },
      {
        id: 'operations-assets',
        label: 'נכסים',
        href: '/operations/assets',
        icon: 'assets',
        description: 'ניהול נכסי הארגון ומעקב אחר מיקום ואחריות.',
        order: 4,
      },
      {
        id: 'operations-tasks',
        label: 'משימות',
        href: '/operations/tasks',
        icon: 'tasks',
        description: 'ניהול משימות צוותיות ומעקב אחר סטטוס ביצוע.',
        order: 5,
      },
      {
        id: 'operations-events',
        label: 'אירועים',
        href: '/operations/events',
        icon: 'events',
        description: 'ניהול לוח אירועים ארגוני ומעקב השתתפות.',
        order: 6,
      },
      {
        id: 'operations-forms',
        label: 'טפסים',
        href: '/operations/forms',
        icon: 'forms',
        description: 'ניהול טפסים דיגיטליים ואיסוף מידע מובנה.',
        order: 7,
      },
    ],
  },
  {
    id: 'system',
    label: 'מערכת',
    order: 4,
    items: [
      {
        id: 'reports',
        label: 'דוחות',
        href: '/reports',
        icon: 'reports',
        description: 'דוחות ניהוליים ותצוגות מותאמות על נתוני הארגון.',
        order: 1,
      },
      {
        id: 'notifications',
        label: 'התראות',
        href: '/notifications',
        icon: 'notifications',
        description: 'ניהול התראות מערכת והעדפות קבלה.',
        order: 2,
      },
      {
        id: 'settings',
        label: 'הגדרות',
        href: '/settings',
        icon: 'settings',
        description: 'הגדרות כלליות של הארגון והמערכת.',
        order: 3,
      },
      {
        id: 'users',
        label: 'משתמשים והרשאות',
        href: '/users',
        icon: 'users',
        description: 'ניהול משתמשים, תפקידים והרשאות גישה.',
        order: 4,
      },
      {
        id: 'audit-log',
        label: 'יומן פעילות',
        href: '/audit-log',
        icon: 'audit-log',
        description: 'תיעוד פעולות משתמשים ואירועי מערכת.',
        order: 5,
      },
    ],
  },
];

function flattenItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? [item, ...flattenItems(item.children)] : [item]));
}

/** All navigation items across every section, flattened (including nested children). */
export function getAllNavItems(): NavItem[] {
  return navigationSections.flatMap((section) => flattenItems(section.items));
}

function findInItems(items: NavItem[], pathname: string): NavItem | undefined {
  for (const item of items) {
    if (item.href === pathname) {
      return item;
    }
    if (item.children) {
      const match = findInItems(item.children, pathname);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
}

/** Finds the section + item whose href exactly matches the given pathname. */
export function findNavMatch(pathname: string): { section: NavSection; item: NavItem } | undefined {
  for (const section of navigationSections) {
    const item = findInItems(section.items, pathname);
    if (item) {
      return { section, item };
    }
  }
  return undefined;
}

/**
 * A route is "active" when it is an exact match, or an ancestor of the
 * current pathname (e.g. a future nested route under an item's href).
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Builds a breadcrumb trail for the given pathname using the navigation
 * config, so pages never need to hardcode their own breadcrumbs.
 *
 * Items in the "main" section render as a single crumb (e.g. "לוח בקרה").
 * Items in other sections are prefixed with their section label
 * (e.g. "כספים / חשבוניות"). The current page is never a link.
 */
export function getBreadcrumbTrail(pathname: string): BreadcrumbEntry[] {
  const match = findNavMatch(pathname);
  if (!match) {
    return [];
  }

  const { section, item } = match;
  if (section.id === 'main') {
    return [{ label: item.label }];
  }

  return [{ label: section.label }, { label: item.label }];
}
