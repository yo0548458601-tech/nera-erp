/**
 * The catalog of individually configurable capabilities. This is the
 * extension point for future modules: a module adds its own permission id
 * here rather than inventing an ad-hoc boolean flag elsewhere in the code.
 */
export type PermissionId =
  | 'notes.edit'
  | 'notes.delete'
  | 'notes.restore'
  | 'entities.edit'
  | 'entities.roles.manage'
  | 'entities.view_sensitive'
  | 'entities.export'
  | 'entities.import'
  | 'entities.merge'
  | 'entities.duplicate_override'
  | 'entities.archive'
  | 'finance.view'
  | 'finance.payment_priority'
  | 'finance.clear_priority_markers'
  | 'modules.access'
  | 'roles.manage_definitions'
  | 'custom_fields.manage'
  | 'custom_fields.view_sensitive'
  | 'list_views.manage_defaults'
  | 'field_requirements.manage_defaults'
  | 'contact_methods.edit'
  | 'contact_methods.deactivate'
  | 'contact_methods.remove'
  | 'contact_methods.restore'
  | 'birth_date.view'
  | 'birth_date.edit';

export type PermissionDefinition = {
  id: PermissionId;
  /** Hebrew label shown in the settings UI. */
  label: string;
  /** Short Hebrew description of what this permission controls. */
  description: string;
};

export const permissionRegistry: PermissionDefinition[] = [
  { id: 'notes.edit', label: 'עריכת הערות', description: 'עריכת תוכן הערה קיימת.' },
  { id: 'notes.delete', label: 'מחיקת הערות', description: 'מחיקה רכה של הערה (ניתנת לשחזור).' },
  { id: 'notes.restore', label: 'שחזור הערות', description: 'שחזור הערה שנמחקה.' },
  {
    id: 'entities.edit',
    label: 'עריכת פרטי ישות',
    description: 'עריכת שם, פרטי זיהוי ופרטי התקשרות של אדם או ארגון.',
  },
  {
    id: 'entities.roles.manage',
    label: 'ניהול תפקידים',
    description: 'הוספה או הסרה של תפקידים המשויכים לישות.',
  },
  {
    id: 'entities.view_sensitive',
    label: 'צפייה במידע רגיש',
    description: 'צפייה במידע זיהוי רגיש כגון מספר זהות מלא.',
  },
  { id: 'entities.export', label: 'ייצוא נתונים', description: 'ייצוא רשימות ונתוני ישויות.' },
  { id: 'entities.import', label: 'ייבוא נתונים', description: 'ייבוא נתוני ישויות ממקור חיצוני.' },
  {
    id: 'entities.merge',
    label: 'מיזוג ישויות כפולות',
    description: 'התחלת תהליך השוואה ומיזוג של ישויות חשודות ככפולות.',
  },
  {
    id: 'entities.duplicate_override',
    label: 'אישור יצירת רשומה נפרדת חרף התאמה',
    description: 'יצירת ישות חדשה במכוון גם כאשר זוהתה התאמה מדויקת עם ישות קיימת.',
  },
  {
    id: 'entities.archive',
    label: 'העברה לארכיון / שחזור ישות',
    description: 'העברת ישות לארכיון או שחזורה ממנו.',
  },
  { id: 'finance.view', label: 'צפייה במידע כספי', description: 'צפייה במידע כספי המשויך לישות.' },
  {
    id: 'finance.payment_priority',
    label: 'שימוש בסימוני עדיפות תשלום',
    description: 'סימון עדיפות עבור תשלומים עתידיים.',
  },
  {
    id: 'finance.clear_priority_markers',
    label: 'ניקוי סימוני עדיפות של משתמשים אחרים',
    description: 'הסרת סימוני עדיפות תשלום שהוגדרו על ידי משתמשים אחרים.',
  },
  {
    id: 'modules.access',
    label: 'גישה למודולים ייעודיים',
    description: 'גישה למודולים או פעולות ספציפיות במערכת.',
  },
  {
    id: 'roles.manage_definitions',
    label: 'ניהול הגדרות תפקידים',
    description: 'יצירה, עריכה והשבתה של הגדרות תפקידים עסקיים (כולל תפקידים מותאמים אישית).',
  },
  {
    id: 'custom_fields.manage',
    label: 'ניהול שדות מותאמים אישית',
    description: 'יצירה, עריכה והשבתה של הגדרות שדות מותאמים אישית.',
  },
  {
    id: 'custom_fields.view_sensitive',
    label: 'צפייה בשדות מותאמים אישית רגישים',
    description: 'צפייה בערכי שדות מותאמים אישית המסומנים כרגישים.',
  },
  {
    id: 'list_views.manage_defaults',
    label: 'ניהול עמודות ברירת מחדל ברשימות',
    description: 'קביעת עמודות ברירת מחדל למסכי רשימה עבור המערכת, מוסד או תפקיד.',
  },
  {
    id: 'field_requirements.manage_defaults',
    label: 'ניהול הגדרות שדה חובה/אופציונלי',
    description:
      'קביעה האם שדה (כגון תאריך לידה) מוסתר, אופציונלי או חובה, לפי סוג ישות, תפקיד או מוסד.',
  },
  {
    id: 'contact_methods.edit',
    label: 'עריכת אמצעי התקשרות',
    description: 'עריכת טלפון, דוא"ל או כתובת קיימים.',
  },
  {
    id: 'contact_methods.deactivate',
    label: 'הפיכת אמצעי התקשרות ללא פעיל',
    description: 'הפיכת טלפון, דוא"ל או כתובת ללא פעילים, או הפעלתם מחדש - הרשומה נשארת בהיסטוריה.',
  },
  {
    id: 'contact_methods.remove',
    label: 'הסרת אמצעי התקשרות',
    description: 'הסרה רכה (הניתנת לשחזור) של טלפון, דוא"ל או כתובת.',
  },
  {
    id: 'contact_methods.restore',
    label: 'שחזור אמצעי התקשרות',
    description: 'שחזור טלפון, דוא"ל או כתובת שהוסרו.',
  },
  {
    id: 'birth_date.view',
    label: 'צפייה בתאריך לידה',
    description: 'צפייה בתאריך הלידה הלועזי והעברי של איש קשר.',
  },
  {
    id: 'birth_date.edit',
    label: 'עריכת תאריך לידה',
    description: 'עריכת תאריך הלידה הלועזי ותיקון התאריך העברי.',
  },
];

export function getPermissionDefinition(permission: PermissionId): PermissionDefinition {
  const definition = permissionRegistry.find(entry => entry.id === permission);
  if (!definition) {
    throw new Error(`Unknown permission: ${permission}`);
  }
  return definition;
}
