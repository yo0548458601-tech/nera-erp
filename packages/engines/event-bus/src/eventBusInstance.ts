import { createEventBus, type EventBus } from './eventBus.js';

/**
 * The shared, process-wide event bus instance real production callers
 * publish/subscribe through (P013A - see `docs/ROADMAP.md`). `createEventBus()`
 * itself deliberately returns a fresh, isolated bus per call (so tests never
 * leak subscriptions into each other - see `eventBus.ts`) - but that means a
 * real caller publishing an event and a real caller subscribing to it must
 * share the *same* instance for delivery to mean anything, exactly the same
 * problem `@nera/database`'s `prisma`/`appPrisma` singletons solve for a
 * database connection. `eventBus` is that same globalThis-cached singleton
 * pattern, applied here. Tests that need isolation continue to call
 * `createEventBus()` directly, never this export.
 */
const globalForEventBus = globalThis as typeof globalThis & {
  eventBus?: EventBus;
};

export const eventBus = globalForEventBus.eventBus ?? createEventBus();

if (process.env.NODE_ENV !== 'production') {
  globalForEventBus.eventBus = eventBus;
}
