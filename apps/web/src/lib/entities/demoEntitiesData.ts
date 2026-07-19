import {
  createDemoNeraIdSequence,
  type Address,
  type AddressType,
  type Email,
  type EmailType,
  type Note,
  type PersonEntity,
  type Phone,
  type PhoneType,
  type RoleAssignment,
} from '@nera/entity-engine';

const DEMO_TENANT_ID = 'tenant-demo';
const DEMO_ADMIN_USER_ID = 'demo-user';

const neraIdSequence = createDemoNeraIdSequence(100);

const phoneTypeLabels: Record<PhoneType, string> = {
  mobile: 'נייד',
  home: 'בית',
  work: 'עבודה',
  fax: 'פקס',
  other: 'אחר',
};
const emailTypeLabels: Record<EmailType, string> = {
  personal: 'אישי',
  work: 'עבודה',
  billing: 'חיוב',
  notifications: 'התראות',
  other: 'אחר',
};

/** Builds one demo Phone record with sensible defaults, keeping the entity list below readable despite the richer P007.4 field set. */
function phone(
  id: string,
  entityId: string,
  number: string,
  type: PhoneType,
  isPrimary: boolean,
  order: number,
  createdAt: string,
  overrides: Partial<Pick<Phone, 'label' | 'status' | 'notes'>> = {}
): Phone {
  return {
    id,
    entityId,
    number,
    type,
    label: overrides.label ?? phoneTypeLabels[type],
    isPrimary,
    status: overrides.status ?? 'active',
    notes: overrides.notes,
    order,
    createdAt,
    updatedAt: createdAt,
    verified: false,
  };
}

function email(
  id: string,
  entityId: string,
  address: string,
  type: EmailType,
  isPrimary: boolean,
  order: number,
  createdAt: string,
  overrides: Partial<Pick<Email, 'label' | 'status' | 'notes'>> = {}
): Email {
  return {
    id,
    entityId,
    address,
    type,
    label: overrides.label ?? emailTypeLabels[type],
    isPrimary,
    status: overrides.status ?? 'active',
    notes: overrides.notes,
    order,
    createdAt,
    updatedAt: createdAt,
    verified: false,
  };
}

function address(
  id: string,
  entityId: string,
  type: AddressType,
  isPrimary: boolean,
  order: number,
  createdAt: string,
  fields: Partial<
    Pick<
      Address,
      | 'country'
      | 'city'
      | 'street'
      | 'houseNumber'
      | 'entrance'
      | 'floor'
      | 'apartment'
      | 'postalCode'
      | 'notes'
    >
  >
): Address {
  return {
    id,
    entityId,
    type,
    isPrimary,
    status: 'active',
    verified: false,
    order,
    createdAt,
    updatedAt: createdAt,
    country: fields.country ?? 'ישראל',
    city: fields.city,
    street: fields.street,
    houseNumber: fields.houseNumber,
    entrance: fields.entrance,
    floor: fields.floor,
    apartment: fields.apartment,
    postalCode: fields.postalCode,
    notes: fields.notes,
  };
}

/**
 * In-memory demo data only - there is no backend or database in this
 * sprint. Deliberately varied: several entities hold more than one role at
 * once, to demonstrate the Entity Engine's core principle that an entity's
 * identity is never duplicated per role. Several entities also carry more
 * than one phone/email/address, to demonstrate the same principle applied
 * to contact methods (P007.4): a "primary" flag is a display convenience,
 * never a limit on how many records exist.
 *
 * Entities, their role assignments and their notes are modeled as three
 * separate collections (each referencing entityId), matching how the
 * future `entities` / `role_assignments` / `entity_notes` database tables
 * would relate to each other.
 */
export const demoPersonEntities: PersonEntity[] = [
  {
    id: 'person-1',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['הנהלה'],
    notesMetadata: { count: 1, lastNoteAt: '2026-05-02T09:00:00.000Z' },
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2026-05-02T09:00:00.000Z',
    profile: {
      entityId: 'person-1',
      firstName: 'יהודה',
      lastName: 'כהן',
      idNumber: '023456789',
      birthDateGregorian: '1985-03-12',
      hebrewDateAdjustmentDays: 0,
      gender: 'male',
      phones: [
        phone(
          'p1-phone-1',
          'person-1',
          '050-1234567',
          'mobile',
          true,
          0,
          '2020-01-01T00:00:00.000Z'
        ),
        phone('p1-phone-2', 'person-1', '02-5551234', 'work', false, 1, '2020-01-01T00:00:00.000Z'),
      ],
      emails: [
        email(
          'p1-email-1',
          'person-1',
          'yehuda.cohen@nera.local',
          'work',
          true,
          0,
          '2020-01-01T00:00:00.000Z'
        ),
      ],
      addresses: [
        address('p1-address-1', 'person-1', 'home', true, 0, '2020-01-01T00:00:00.000Z', {
          street: 'הרב קוק',
          houseNumber: '12',
          city: 'ירושלים',
          postalCode: '9100000',
        }),
      ],
    },
  },
  {
    id: 'person-2',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['כספים'],
    notesMetadata: { count: 0 },
    createdAt: '2021-06-01T00:00:00.000Z',
    updatedAt: '2021-06-01T00:00:00.000Z',
    profile: {
      entityId: 'person-2',
      firstName: 'רבקה',
      lastName: 'לוי',
      idNumber: '034567891',
      birthDateGregorian: '1990-07-22',
      hebrewDateAdjustmentDays: 0,
      gender: 'female',
      phones: [
        phone(
          'p2-phone-1',
          'person-2',
          '052-2345678',
          'mobile',
          true,
          0,
          '2021-06-01T00:00:00.000Z'
        ),
        phone('p2-phone-2', 'person-2', '03-5551234', 'home', false, 1, '2021-06-01T00:00:00.000Z'),
      ],
      emails: [
        email(
          'p2-email-1',
          'person-2',
          'rivka.levi@nera.local',
          'work',
          true,
          0,
          '2021-06-01T00:00:00.000Z'
        ),
        email(
          'p2-email-2',
          'person-2',
          'rivka.private@example.com',
          'personal',
          false,
          1,
          '2021-06-01T00:00:00.000Z'
        ),
      ],
      addresses: [
        address('p2-address-1', 'person-2', 'home', true, 0, '2021-06-01T00:00:00.000Z', {
          city: 'בני ברק',
          street: 'רבי עקיבא',
          houseNumber: '45',
        }),
      ],
    },
  },
  {
    id: 'person-3',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['כולל א', 'תורם קבוע'],
    notesMetadata: { count: 0 },
    createdAt: '2019-09-01T00:00:00.000Z',
    updatedAt: '2022-01-15T00:00:00.000Z',
    profile: {
      entityId: 'person-3',
      firstName: 'משה',
      lastName: 'בן-דוד',
      idNumber: '045678912',
      birthDateGregorian: '1978-11-05',
      hebrewDateAdjustmentDays: 0,
      gender: 'male',
      phones: [
        phone(
          'p3-phone-1',
          'person-3',
          '054-3456789',
          'mobile',
          true,
          0,
          '2019-09-01T00:00:00.000Z'
        ),
      ],
      emails: [
        email(
          'p3-email-1',
          'person-3',
          'moshe.bd@example.com',
          'personal',
          true,
          0,
          '2019-09-01T00:00:00.000Z'
        ),
      ],
      addresses: [
        address('p3-address-1', 'person-3', 'home', true, 0, '2019-09-01T00:00:00.000Z', {
          city: 'ירושלים',
          street: 'מלכי ישראל',
          houseNumber: '8',
        }),
      ],
    },
  },
  {
    id: 'person-4',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: [],
    notesMetadata: { count: 0 },
    createdAt: '2023-03-01T00:00:00.000Z',
    updatedAt: '2023-03-01T00:00:00.000Z',
    profile: {
      entityId: 'person-4',
      firstName: 'שרה',
      lastName: 'אברג׳יל',
      birthDateGregorian: '1988-02-18',
      hebrewDateAdjustmentDays: 0,
      gender: 'female',
      phones: [
        phone(
          'p4-phone-1',
          'person-4',
          '053-4567890',
          'mobile',
          true,
          0,
          '2023-03-01T00:00:00.000Z'
        ),
      ],
      emails: [],
      addresses: [],
    },
  },
  {
    id: 'person-5',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['ספק ציוד'],
    notesMetadata: { count: 0 },
    createdAt: '2018-04-10T00:00:00.000Z',
    updatedAt: '2018-04-10T00:00:00.000Z',
    profile: {
      entityId: 'person-5',
      firstName: 'דוד',
      lastName: 'מזרחי',
      idNumber: '056789123',
      hebrewDateAdjustmentDays: 0,
      gender: 'male',
      phones: [
        phone(
          'p5-phone-1',
          'person-5',
          '050-5678901',
          'mobile',
          true,
          0,
          '2018-04-10T00:00:00.000Z'
        ),
        phone('p5-phone-2', 'person-5', '03-6667788', 'work', false, 1, '2018-04-10T00:00:00.000Z'),
        phone('p5-phone-3', 'person-5', '03-6667789', 'fax', false, 2, '2018-04-10T00:00:00.000Z', {
          label: 'פקס המחסן',
        }),
      ],
      emails: [
        email(
          'p5-email-1',
          'person-5',
          'david@mizrahi-supply.co.il',
          'work',
          true,
          0,
          '2018-04-10T00:00:00.000Z'
        ),
      ],
      addresses: [
        address('p5-address-1', 'person-5', 'work', true, 0, '2018-04-10T00:00:00.000Z', {
          city: 'תל אביב',
          street: 'הרצל',
          houseNumber: '3',
          floor: '2',
        }),
      ],
    },
  },
  {
    id: 'person-6',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['כיתה ה'],
    notesMetadata: { count: 0 },
    createdAt: '2020-09-01T00:00:00.000Z',
    updatedAt: '2020-09-01T00:00:00.000Z',
    profile: {
      entityId: 'person-6',
      firstName: 'חנה',
      lastName: 'פרידמן',
      birthDateGregorian: '2013-09-01',
      hebrewDateAdjustmentDays: 0,
      gender: 'female',
      phones: [],
      emails: [],
      addresses: [],
    },
  },
  {
    id: 'person-7',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'inactive',
    tenantId: DEMO_TENANT_ID,
    tags: ['כולל ב'],
    notesMetadata: { count: 1, lastNoteAt: '2025-08-01T00:00:00.000Z' },
    createdAt: '2017-02-01T00:00:00.000Z',
    updatedAt: '2025-08-01T00:00:00.000Z',
    profile: {
      entityId: 'person-7',
      firstName: 'יעקב',
      lastName: 'שטיינברג',
      idNumber: '067891234',
      birthDateGregorian: '1982-01-30',
      hebrewDateAdjustmentDays: 0,
      gender: 'male',
      phones: [
        phone(
          'p7-phone-1',
          'person-7',
          '058-6789012',
          'mobile',
          true,
          0,
          '2017-02-01T00:00:00.000Z'
        ),
      ],
      emails: [
        email(
          'p7-email-1',
          'person-7',
          'yaakov.s@example.com',
          'personal',
          true,
          0,
          '2017-02-01T00:00:00.000Z'
        ),
      ],
      addresses: [],
    },
  },
  {
    id: 'person-8',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['תורם קבוע'],
    notesMetadata: { count: 0 },
    createdAt: '2016-12-01T00:00:00.000Z',
    updatedAt: '2016-12-01T00:00:00.000Z',
    profile: {
      entityId: 'person-8',
      firstName: 'מרים',
      lastName: 'כץ',
      hebrewDateAdjustmentDays: 0,
      gender: 'female',
      phones: [
        phone(
          'p8-phone-1',
          'person-8',
          '054-7890123',
          'mobile',
          true,
          0,
          '2016-12-01T00:00:00.000Z'
        ),
      ],
      emails: [
        email(
          'p8-email-1',
          'person-8',
          'miriam.katz@example.com',
          'personal',
          true,
          0,
          '2016-12-01T00:00:00.000Z'
        ),
      ],
      addresses: [
        address('p8-address-1', 'person-8', 'billing', true, 0, '2016-12-01T00:00:00.000Z', {
          city: 'רעננה',
          street: 'אחוזה',
          houseNumber: '22',
        }),
      ],
    },
  },
  {
    id: 'person-9',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'active',
    tenantId: DEMO_TENANT_ID,
    tags: ['IT', 'הנהלה'],
    notesMetadata: { count: 0 },
    createdAt: '2015-01-01T00:00:00.000Z',
    updatedAt: '2015-01-01T00:00:00.000Z',
    profile: {
      entityId: 'person-9',
      firstName: 'אליהו',
      lastName: 'פרץ',
      idNumber: '078912345',
      birthDateGregorian: '1975-06-14',
      hebrewDateAdjustmentDays: 0,
      gender: 'male',
      phones: [
        phone(
          'p9-phone-1',
          'person-9',
          '050-8901234',
          'mobile',
          true,
          0,
          '2015-01-01T00:00:00.000Z'
        ),
      ],
      emails: [
        email(
          'p9-email-1',
          'person-9',
          'eli.peretz@nera.local',
          'work',
          true,
          0,
          '2015-01-01T00:00:00.000Z'
        ),
      ],
      addresses: [
        address('p9-address-1', 'person-9', 'home', true, 0, '2015-01-01T00:00:00.000Z', {
          city: 'ירושלים',
          street: 'יפו',
          houseNumber: '100',
          entrance: 'ב',
          floor: '3',
          apartment: '12',
        }),
      ],
    },
  },
  {
    id: 'person-10',
    neraId: neraIdSequence.next(),
    entityType: 'person',
    status: 'archived',
    tenantId: DEMO_TENANT_ID,
    tags: [],
    notesMetadata: { count: 1, lastNoteAt: '2024-01-10T00:00:00.000Z' },
    createdAt: '2019-05-01T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    profile: {
      entityId: 'person-10',
      firstName: 'תמר',
      lastName: 'אזולאי',
      hebrewDateAdjustmentDays: 0,
      gender: 'female',
      phones: [
        phone(
          'p10-phone-1',
          'person-10',
          '052-9012345',
          'mobile',
          true,
          0,
          '2019-05-01T00:00:00.000Z'
        ),
      ],
      emails: [],
      addresses: [],
    },
  },
];

export const demoRoleAssignments: RoleAssignment[] = [
  {
    id: 'p1-role-1',
    entityId: 'person-1',
    role: 'employee',
    organizationId: 'org-main',
    status: 'active',
    createdAt: '2020-01-01T00:00:00.000Z',
  },
  {
    id: 'p1-role-2',
    entityId: 'person-1',
    role: 'parent',
    status: 'active',
    createdAt: '2020-01-01T00:00:00.000Z',
  },
  {
    id: 'p2-role-1',
    entityId: 'person-2',
    role: 'employee',
    organizationId: 'org-bnei-brak',
    status: 'active',
    createdAt: '2021-06-01T00:00:00.000Z',
  },
  {
    id: 'p3-role-1',
    entityId: 'person-3',
    role: 'avreich',
    organizationId: 'org-jerusalem',
    status: 'active',
    createdAt: '2019-09-01T00:00:00.000Z',
  },
  {
    id: 'p3-role-2',
    entityId: 'person-3',
    role: 'donor',
    status: 'active',
    createdAt: '2022-01-15T00:00:00.000Z',
  },
  {
    id: 'p4-role-1',
    entityId: 'person-4',
    role: 'parent',
    status: 'active',
    createdAt: '2023-03-01T00:00:00.000Z',
  },
  {
    id: 'p5-role-1',
    entityId: 'person-5',
    role: 'individual_supplier',
    status: 'active',
    createdAt: '2018-04-10T00:00:00.000Z',
  },
  {
    id: 'p5-role-2',
    entityId: 'person-5',
    role: 'contact',
    status: 'active',
    createdAt: '2018-04-10T00:00:00.000Z',
  },
  {
    id: 'p6-role-1',
    entityId: 'person-6',
    role: 'student',
    organizationId: 'org-jerusalem',
    status: 'active',
    createdAt: '2020-09-01T00:00:00.000Z',
  },
  {
    id: 'p7-role-1',
    entityId: 'person-7',
    role: 'avreich',
    organizationId: 'org-jerusalem',
    status: 'ended',
    createdAt: '2017-02-01T00:00:00.000Z',
    endDate: '2025-08-01',
  },
  {
    id: 'p8-role-1',
    entityId: 'person-8',
    role: 'donor',
    status: 'active',
    createdAt: '2016-12-01T00:00:00.000Z',
  },
  {
    id: 'p9-role-1',
    entityId: 'person-9',
    role: 'employee',
    organizationId: 'org-main',
    status: 'active',
    createdAt: '2015-01-01T00:00:00.000Z',
  },
  {
    id: 'p9-role-2',
    entityId: 'person-9',
    role: 'administrator',
    status: 'active',
    createdAt: '2015-01-01T00:00:00.000Z',
  },
  {
    id: 'p10-role-1',
    entityId: 'person-10',
    role: 'contact',
    status: 'active',
    createdAt: '2019-05-01T00:00:00.000Z',
  },
];

export const demoNotes: Note[] = [
  {
    id: 'p1-note-1',
    entityId: 'person-1',
    content: 'איש קשר ראשי מול הנהלת החשבונות.',
    createdByUserId: DEMO_ADMIN_USER_ID,
    createdAt: '2026-05-02T09:00:00.000Z',
    updatedAt: '2026-05-02T09:00:00.000Z',
    revisions: [],
  },
  {
    id: 'p7-note-1',
    entityId: 'person-7',
    content: 'עבר למוסד אחר, נשאר ברשימה לצורכי ארכיון.',
    createdByUserId: DEMO_ADMIN_USER_ID,
    createdAt: '2025-08-01T00:00:00.000Z',
    updatedAt: '2025-08-01T00:00:00.000Z',
    revisions: [],
  },
  {
    id: 'p10-note-1',
    entityId: 'person-10',
    content: 'רשומה ארכיונית - אין פעילות פעילה.',
    createdByUserId: DEMO_ADMIN_USER_ID,
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    revisions: [],
  },
];
