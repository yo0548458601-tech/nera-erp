import { describe, expect, it } from 'vitest';
import {
  assertValidEngineRegistry,
  engineRegistry,
  findEngineRegistryIssues,
  getEngine,
  getEnginesByStatus,
  getOptionalEngines,
  getRequiredEngines,
  listEngines,
  type EngineDescriptor,
} from './engine';

describe('engineRegistry', () => {
  it('is valid: no duplicate ids, no unknown dependency references, no cycles', () => {
    expect(findEngineRegistryIssues()).toEqual([]);
    expect(() => assertValidEngineRegistry()).not.toThrow();
  });

  it('has exactly one entry per engine documented in ENGINE_MAP.md, plus the Calendar appendix', () => {
    expect(engineRegistry).toHaveLength(17);
  });

  it('every entry has all required narrative fields populated (non-empty strings)', () => {
    const narrativeFields: Array<keyof EngineDescriptor> = [
      'responsibility',
      'boundaries',
      'ownedData',
      'securityRequirements',
      'auditRequirements',
      'extensionPoints',
    ];

    for (const entry of engineRegistry) {
      for (const field of narrativeFields) {
        expect(entry[field], `${entry.id}.${String(field)}`).toBeTruthy();
      }
    }
  });

  it('authorization, organization-institution, audit and calendar are "existing" - the four engines with real callers wired into apps/web (P013A)', () => {
    expect(getEnginesByStatus('existing').map(entry => entry.id)).toEqual([
      'authorization',
      'organization-institution',
      'audit',
      'calendar',
    ]);
  });

  it('classifies exactly the 16 engines in ENGINE_MAP.md\'s required list as "required", and only Calendar as "optional"', () => {
    const required = getRequiredEngines();
    const optional = getOptionalEngines();

    expect(required).toHaveLength(16);
    expect(optional.map(entry => entry.id)).toEqual(['calendar']);
    expect(required.some(entry => entry.id === 'calendar')).toBe(false);
  });

  it('every entry has a classification, and required + optional partition the whole registry with no overlap', () => {
    for (const entry of engineRegistry) {
      expect(['required', 'optional']).toContain(entry.classification);
    }
    expect(getRequiredEngines().length + getOptionalEngines().length).toBe(engineRegistry.length);
  });

  it('getEngine finds a known engine and returns undefined for an unknown id', () => {
    expect(getEngine('entity')?.packageName).toBe('@nera/entity-engine');
    // @ts-expect-error - deliberately not a real EngineId, to prove getEngine doesn't throw on a bad lookup
    expect(getEngine('not-a-real-engine')).toBeUndefined();
  });

  it('listEngines returns the full registry by default', () => {
    expect(listEngines()).toBe(engineRegistry);
  });

  it('business-event-bus depends on audit, matching ENGINE_MAP.md Section 16 exactly (regression test for a P008-review-found transcription gap)', () => {
    expect(getEngine('business-event-bus')?.dependencies).toEqual(
      expect.arrayContaining(['organization-institution', 'audit'])
    );
  });

  describe('P010 (Audit Engine & Business Event Bus)', () => {
    it('audit is implemented by @nera/audit-engine', () => {
      expect(getEngine('audit')?.packageName).toBe('@nera/audit-engine');
    });

    it('business-event-bus is implemented by @nera/event-bus-engine', () => {
      expect(getEngine('business-event-bus')?.packageName).toBe('@nera/event-bus-engine');
    });

    it('audit was "partial" through P012 - a real writer existed but nothing called it yet (no real caller wired into apps/web until P013A - see the P013A describe block below)', () => {
      expect(getEngine('audit')?.status).toBe('existing');
    });

    it('business-event-bus is now "partial", not "planned" - a real in-process implementation exists but nothing publishes/subscribes yet', () => {
      expect(getEngine('business-event-bus')?.status).toBe('partial');
    });

    it('business-event-bus still depends on audit and not the reverse - audit must never depend on business-event-bus, or the two would form a cycle', () => {
      expect(getEngine('business-event-bus')?.dependencies).toContain('audit');
      expect(getEngine('audit')?.dependencies).not.toContain('business-event-bus');
    });

    it('the registry is still valid after the P010 packageName/status updates - no duplicate ids, no unknown references, no cycles', () => {
      expect(findEngineRegistryIssues()).toEqual([]);
    });
  });

  describe('P012 (Organization / Institution Engine)', () => {
    it('organization-institution is implemented by @nera/organization-engine', () => {
      expect(getEngine('organization-institution')?.packageName).toBe('@nera/organization-engine');
    });

    it('organization-institution was "partial" through P012 - real, tested infrastructure existed but nothing called it yet (no real caller wired into apps/web until P013A)', () => {
      expect(getEngine('organization-institution')?.status).toBe('existing');
    });

    it('the registry is still valid after the P012 packageName update - no duplicate ids, no unknown references, no cycles', () => {
      expect(findEngineRegistryIssues()).toEqual([]);
    });
  });

  describe('P013A (Entity Persistence & Real Contacts)', () => {
    it('authorization, organization-institution and audit are now "existing" - Server Actions in apps/web call checkPermission/getOrganizationContext/recordAudit for real for the first time', () => {
      expect(getEngine('authorization')?.status).toBe('existing');
      expect(getEngine('organization-institution')?.status).toBe('existing');
      expect(getEngine('audit')?.status).toBe('existing');
    });

    it('entity remains "partial", not "existing" - the person-side slice (entities, person_profiles, contact methods, notes, role_assignments, duplicate_override_records) is real, but organization_profiles/module_profiles/merge/financial remain unbuilt', () => {
      expect(getEngine('entity')?.status).toBe('partial');
      expect(getEngine('entity')?.ownedData).toContain('phones');
      expect(getEngine('entity')?.ownedData).toContain(
        'organization_profiles and module_profiles remain modeled as TypeScript types only'
      );
    });

    it('the registry is still valid after the P013A status updates - no duplicate ids, no unknown references, no cycles', () => {
      expect(findEngineRegistryIssues()).toEqual([]);
    });
  });
});

describe('findEngineRegistryIssues', () => {
  it('flags a duplicate id', () => {
    const duplicate: EngineDescriptor = { ...engineRegistry[0] };
    const issues = findEngineRegistryIssues([duplicate, duplicate]);
    expect(issues.some(issue => issue.includes('Duplicate engine id'))).toBe(true);
  });

  it('flags a dependency pointing at an unknown engine', () => {
    const broken: EngineDescriptor = {
      ...engineRegistry[0],
      // @ts-expect-error - deliberately invalid, to test the validator
      dependencies: ['does-not-exist'],
    };
    const issues = findEngineRegistryIssues([broken]);
    expect(issues.some(issue => issue.includes('unknown engine'))).toBe(true);
  });

  it('flags a direct dependency cycle', () => {
    const a: EngineDescriptor = { ...engineRegistry[0], id: 'audit', dependencies: ['workflow'] };
    const b: EngineDescriptor = { ...engineRegistry[0], id: 'workflow', dependencies: ['audit'] };
    const issues = findEngineRegistryIssues([a, b]);
    expect(issues.some(issue => issue.includes('Dependency cycle detected'))).toBe(true);
  });
});
