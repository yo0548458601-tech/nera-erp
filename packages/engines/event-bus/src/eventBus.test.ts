import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './eventBus';

describe('createEventBus', () => {
  it('publish with no subscribers delivers to nobody and reports no failures', async () => {
    const bus = createEventBus();

    const result = await bus.publish({ eventType: 'entity.created', payload: { id: '1' } });

    expect(result.deliveredCount).toBe(0);
    expect(result.failures).toEqual([]);
    expect(result.event.eventType).toBe('entity.created');
  });

  it('delivers to a single subscriber', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe('entity.created', handler);

    const result = await bus.publish({ eventType: 'entity.created', payload: { id: '1' } });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(result.event);
    expect(result.deliveredCount).toBe(1);
  });

  it('delivers to multiple subscribers of the same event type', async () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();
    const third = vi.fn();
    bus.subscribe('entity.created', first);
    bus.subscribe('entity.created', second);
    bus.subscribe('entity.created', third);

    const result = await bus.publish({ eventType: 'entity.created', payload: { id: '1' } });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
    expect(result.deliveredCount).toBe(3);
  });

  it('never delivers to a subscriber of a different event type', async () => {
    const bus = createEventBus();
    const entityHandler = vi.fn();
    const workflowHandler = vi.fn();
    bus.subscribe('entity.created', entityHandler);
    bus.subscribe('workflow.started', workflowHandler);

    await bus.publish({ eventType: 'entity.created', payload: {} });

    expect(entityHandler).toHaveBeenCalledTimes(1);
    expect(workflowHandler).not.toHaveBeenCalled();
  });

  describe('unsubscribe', () => {
    it('stops delivering to a subscriber after it unsubscribes', async () => {
      const bus = createEventBus();
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('entity.created', handler);

      unsubscribe();
      const result = await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(handler).not.toHaveBeenCalled();
      expect(result.deliveredCount).toBe(0);
    });

    it('only removes the specific subscription, leaving other subscribers to the same event intact', async () => {
      const bus = createEventBus();
      const first = vi.fn();
      const second = vi.fn();
      const unsubscribeFirst = bus.subscribe('entity.created', first);
      bus.subscribe('entity.created', second);

      unsubscribeFirst();
      await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('calling unsubscribe a second time is a harmless no-op', async () => {
      const bus = createEventBus();
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('entity.created', handler);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();

      await bus.publish({ eventType: 'entity.created', payload: {} });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('delivery order', () => {
    it('invokes subscribers in registration order, sequentially, matching the documented contract', async () => {
      const bus = createEventBus();
      const order: string[] = [];
      bus.subscribe('entity.created', async () => {
        order.push('first');
      });
      bus.subscribe('entity.created', async () => {
        order.push('second');
      });
      bus.subscribe('entity.created', () => {
        order.push('third');
      });

      await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(order).toEqual(['first', 'second', 'third']);
    });
  });

  describe('subscriber failure isolation', () => {
    it('one subscriber throwing synchronously does not prevent the remaining subscribers from running', async () => {
      const bus = createEventBus();
      const before = vi.fn();
      const after = vi.fn();
      bus.subscribe('entity.created', before);
      bus.subscribe('entity.created', () => {
        throw new Error('boom');
      });
      bus.subscribe('entity.created', after);

      const result = await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(before).toHaveBeenCalledTimes(1);
      expect(after).toHaveBeenCalledTimes(1);
      expect(result.deliveredCount).toBe(2);
    });

    it('one subscriber rejecting asynchronously does not prevent the remaining subscribers from running', async () => {
      const bus = createEventBus();
      const after = vi.fn();
      bus.subscribe('entity.created', async () => {
        throw new Error('async boom');
      });
      bus.subscribe('entity.created', after);

      const result = await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(after).toHaveBeenCalledTimes(1);
      expect(result.deliveredCount).toBe(1);
    });

    it('reports structured failure information rather than swallowing the error', async () => {
      const bus = createEventBus();
      const failure = new Error('boom');
      bus.subscribe('entity.created', () => {
        throw failure;
      });

      const result = await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error).toBe(failure);
      expect(typeof result.failures[0].subscriptionId).toBe('string');
      expect(result.failures[0].subscriptionId.length).toBeGreaterThan(0);
    });

    it('publish() itself never throws, even when every subscriber fails', async () => {
      const bus = createEventBus();
      bus.subscribe('entity.created', () => {
        throw new Error('one');
      });
      bus.subscribe('entity.created', () => {
        throw new Error('two');
      });

      await expect(
        bus.publish({ eventType: 'entity.created', payload: {} })
      ).resolves.toMatchObject({ deliveredCount: 0 });
    });

    it('does not recursively re-publish onto the bus when a subscriber fails', async () => {
      const bus = createEventBus();
      const observabilityHandler = vi.fn();
      bus.subscribe('event-bus.subscriber-failed', observabilityHandler);
      bus.subscribe('entity.created', () => {
        throw new Error('boom');
      });

      await bus.publish({ eventType: 'entity.created', payload: {} });

      // No implicit "EventBusSubscriberFailed" event is published anywhere -
      // failures are only ever reported in the direct publish() return value.
      expect(observabilityHandler).not.toHaveBeenCalled();
    });
  });

  describe('no persistence', () => {
    it('a subscriber added after publish() never receives the earlier event', async () => {
      const bus = createEventBus();
      await bus.publish({ eventType: 'entity.created', payload: { id: 'early' } });

      const lateHandler = vi.fn();
      bus.subscribe('entity.created', lateHandler);

      expect(lateHandler).not.toHaveBeenCalled();
    });

    it('a fresh bus instance shares no state with a previous one', async () => {
      const busA = createEventBus();
      const handlerA = vi.fn();
      busA.subscribe('entity.created', handlerA);

      const busB = createEventBus();
      await busB.publish({ eventType: 'entity.created', payload: {} });

      expect(handlerA).not.toHaveBeenCalled();
    });
  });

  describe('payload handling (no isolation guarantee, documented behavior)', () => {
    it('delivers the same payload reference to every subscriber', async () => {
      const bus = createEventBus();
      const payload = { count: 0 };
      const seenByFirst: unknown[] = [];
      const seenBySecond: unknown[] = [];
      bus.subscribe('counter.tick', event => {
        seenByFirst.push(event.payload);
      });
      bus.subscribe('counter.tick', event => {
        seenBySecond.push(event.payload);
      });

      await bus.publish({ eventType: 'counter.tick', payload });

      expect(seenByFirst[0]).toBe(payload);
      expect(seenBySecond[0]).toBe(payload);
    });

    it('a mutation by an earlier subscriber is visible to a later subscriber (no isolation)', async () => {
      const bus = createEventBus();
      const payload: { count: number } = { count: 0 };
      bus.subscribe('counter.tick', event => {
        (event.payload as { count: number }).count += 1;
      });

      let observedByLast = 0;
      bus.subscribe('counter.tick', event => {
        observedByLast = (event.payload as { count: number }).count;
      });

      await bus.publish({ eventType: 'counter.tick', payload });

      expect(observedByLast).toBe(1);
    });
  });

  describe('handler contract (sync and async both supported)', () => {
    it('supports a purely synchronous handler', async () => {
      const bus = createEventBus();
      let called = false;
      bus.subscribe('entity.created', () => {
        called = true;
      });

      await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(called).toBe(true);
    });

    it('awaits an async handler before counting it as delivered', async () => {
      const bus = createEventBus();
      let resolved = false;
      bus.subscribe('entity.created', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        resolved = true;
      });

      const result = await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(resolved).toBe(true);
      expect(result.deliveredCount).toBe(1);
    });
  });

  describe('event envelope', () => {
    it('generates a unique eventId and occurredAt when not provided', async () => {
      const bus = createEventBus();
      const resultA = await bus.publish({ eventType: 'entity.created', payload: {} });
      const resultB = await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(resultA.event.eventId).not.toBe(resultB.event.eventId);
      expect(resultA.event.occurredAt).toBeInstanceOf(Date);
    });

    it('honors an explicit eventId and occurredAt, for replay/test use', async () => {
      const bus = createEventBus();
      const occurredAt = new Date('2020-01-01T00:00:00.000Z');

      const result = await bus.publish({
        eventType: 'entity.created',
        eventId: 'fixed-id',
        occurredAt,
        payload: {},
      });

      expect(result.event.eventId).toBe('fixed-id');
      expect(result.event.occurredAt).toBe(occurredAt);
    });

    it('carries organizationId and actor through to subscribers when provided', async () => {
      const bus = createEventBus();
      const handler = vi.fn();
      bus.subscribe('entity.created', handler);

      await bus.publish({
        eventType: 'entity.created',
        organizationId: 'org-1',
        actor: { userProfileId: 'user-1', membershipId: 'membership-1' },
        payload: {},
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          actor: { userProfileId: 'user-1', membershipId: 'membership-1' },
        })
      );
    });

    it('defaults actor to null for a system-initiated event', async () => {
      const bus = createEventBus();
      const handler = vi.fn();
      bus.subscribe('entity.created', handler);

      await bus.publish({ eventType: 'entity.created', payload: {} });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ actor: null }));
    });
  });
});
