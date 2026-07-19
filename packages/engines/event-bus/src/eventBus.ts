/**
 * Business Event Bus (`ENGINE_MAP.md` Section 16; P010 - see `docs/ROADMAP.md`).
 *
 * An in-process publish/subscribe mechanism only. Per
 * `NERA_CONSTITUTION.md` ("in-process domain events, not a distributed
 * queue at this stage") and the P010 owner decisions: no external broker, no
 * persistence, no retries, no background worker, no network dependency.
 * Every subscriber for a given `publish()` call runs within that same
 * `publish()` call's process and lifetime - nothing survives a process
 * restart.
 *
 * Dependency direction (preserved from `packages/core/src/engine.ts`,
 * already accepted in P008): `business-event-bus` depends on `audit`, never
 * the reverse. This package itself has no dependency on `@nera/audit-engine`
 * - the direction is enforced at the call-site level (a future engine may
 * call both `recordAudit()` and `publish()` at the same mutation site) and
 * recorded in the engine registry, not by an import here.
 *
 * Handler contract: subscribers may be synchronous or return a `Promise`
 * (`EventHandler` returns `void | Promise<void>`). `publish()` awaits each
 * subscriber in registration order, one at a time - not `Promise.all` -
 * so delivery order is deterministic and a slow or failing subscriber can
 * never race a later one. This is the simplest contract that still supports
 * the realistic future case (a server-side engine subscriber that itself
 * awaits a database write, e.g. the Audit Engine).
 *
 * Failure isolation: one subscriber throwing (synchronously or via a
 * rejected promise) never prevents the remaining subscribers for that event
 * from running, and is never silently swallowed - `publish()` returns a
 * structured `PublishResult` with a `failures` array (subscription id +
 * the thrown error) for the caller to inspect. There is deliberately no
 * automatic re-publishing of an "EventBusSubscriberFailed" domain event from
 * inside this failure path: a bus that publishes onto itself when a
 * subscriber fails is one step from an unbounded or ambiguous recursion
 * (what happens when the failure-reporting subscriber itself fails?) for no
 * real benefit here, since the same information is already returned
 * directly to the publisher. A caller that wants failures to be audited or
 * observed elsewhere does so explicitly with the returned `PublishResult`.
 *
 * Payload handling: no isolation or immutability guarantee is made. A
 * payload is passed by reference to every subscriber for that event,
 * unmodified by the bus itself; a subscriber that mutates a shared payload
 * can affect what later subscribers observe. Callers that need isolation
 * must not share mutable payload objects across publishes, or must clone
 * before passing one in.
 */

export type EventActor = {
  userProfileId: string;
  membershipId?: string | null;
} | null;

/** The envelope every subscriber receives - the minimum useful cross-engine fields, not a universal enterprise event schema. */
export type DomainEvent<TPayload = unknown> = {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  /** Present when the event is tenant-scoped - most business events are. */
  organizationId?: string;
  /** `null`/omitted for a system-initiated event. */
  actor?: EventActor;
  payload: TPayload;
  metadata?: unknown;
};

export type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>
) => void | Promise<void>;

export type PublishInput<TPayload = unknown> = {
  eventType: string;
  organizationId?: string;
  actor?: EventActor;
  payload: TPayload;
  metadata?: unknown;
  /** Overrides the generated event id - mainly useful for tests. */
  eventId?: string;
  /** Overrides the generated timestamp - mainly useful for tests/replay. */
  occurredAt?: Date;
};

export type SubscriberFailure = {
  subscriptionId: string;
  error: unknown;
};

export type PublishResult<TPayload = unknown> = {
  event: DomainEvent<TPayload>;
  /** How many subscribers ran to completion without throwing. */
  deliveredCount: number;
  /** Every subscriber that threw, in the order they were invoked. Empty if all succeeded (or there were no subscribers). */
  failures: SubscriberFailure[];
};

export type Unsubscribe = () => void;

export type EventBus = {
  /** Registers `handler` for `eventType`. Returns a function that removes this one subscription. */
  subscribe<TPayload = unknown>(eventType: string, handler: EventHandler<TPayload>): Unsubscribe;
  /** Delivers the event to every current subscriber of `input.eventType`, in registration order. Never throws - failures are reported in the returned result. */
  publish<TPayload = unknown>(input: PublishInput<TPayload>): Promise<PublishResult<TPayload>>;
};

type Subscription = {
  id: string;
  handler: EventHandler;
};

function generateId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Factory, not a singleton - matches the rest of `packages/engines/*` and
 * `@nera/core`'s stateless-function convention (see `createProviderRegistry`,
 * `createPluginRegistry`). Each call returns an independent bus so tests
 * never leak subscriptions into each other.
 */
export function createEventBus(): EventBus {
  const subscriptionsByEventType = new Map<string, Subscription[]>();

  function subscribe<TPayload = unknown>(
    eventType: string,
    handler: EventHandler<TPayload>
  ): Unsubscribe {
    const subscription: Subscription = { id: generateId(), handler: handler as EventHandler };
    const existing = subscriptionsByEventType.get(eventType) ?? [];
    subscriptionsByEventType.set(eventType, [...existing, subscription]);

    return () => {
      const current = subscriptionsByEventType.get(eventType);
      if (!current) {
        return;
      }
      subscriptionsByEventType.set(
        eventType,
        current.filter(entry => entry.id !== subscription.id)
      );
    };
  }

  async function publish<TPayload = unknown>(
    input: PublishInput<TPayload>
  ): Promise<PublishResult<TPayload>> {
    const event: DomainEvent<TPayload> = {
      eventId: input.eventId ?? generateId(),
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date(),
      organizationId: input.organizationId,
      actor: input.actor ?? null,
      payload: input.payload,
      metadata: input.metadata,
    };

    const subscribers = subscriptionsByEventType.get(input.eventType) ?? [];
    let deliveredCount = 0;
    const failures: SubscriberFailure[] = [];

    for (const subscriber of subscribers) {
      try {
        await subscriber.handler(event);
        deliveredCount += 1;
      } catch (error) {
        failures.push({ subscriptionId: subscriber.id, error });
      }
    }

    return { event, deliveredCount, failures };
  }

  return { subscribe, publish };
}
