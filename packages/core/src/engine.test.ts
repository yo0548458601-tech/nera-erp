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

  it('the Calendar engine is the only "existing" entry, matching ENGINE_MAP.md', () => {
    expect(getEnginesByStatus('existing').map(entry => entry.id)).toEqual(['calendar']);
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
