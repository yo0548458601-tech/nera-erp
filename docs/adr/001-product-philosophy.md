# ADR-001 — Product Philosophy

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

Milestone 1 (Product Blueprint) needs a single, binding statement of what Nera fundamentally _is_ and what it is _for_, so that every later architecture and product decision — including every future ADR — has a stable reference point instead of being re-derived from scratch each time. Prior foundation documents (`PROJECT_VISION.md`) described a universal platform vision but did not fix the specific product promise ("what should using Nera feel like") that Milestone 1's product blueprint introduced.

## Decision

1. **Nera is a general-purpose, modular ERP platform.** It is not built for one industry. The first customer may be a yeshiva or Torah institution, but industry-specific concepts belong to business modules, never to the platform core.
2. **The system should feel like a professional employee working alongside the user** — accurate, unobtrusive, and trustworthy — not a black box and not a replacement for the user's own judgment.
3. **Accuracy is more important than speed.** Where a faster path risks a wrong, unclear, or unreviewable result, Nera takes the slower, correct path instead.
4. **The user retains final control.** Nera assists; it never decides on the user's behalf for anything the user has not explicitly delegated. This is the platform's golden principle and applies to every feature, automated or not, present or future.

## Consequences

- Every product and engineering decision can be tested against this ADR: does it keep the system accurate, does it keep the user in control, does it avoid baking industry assumptions into the core?
- Speed-for-its-own-sake optimizations (skipping validation, skipping review steps, auto-applying an uncertain result) are disallowed by default and require an explicit, separate justification to reconsider.
- Feature requests that would make Nera decide autonomously on sensitive/irreversible actions are out of scope unless a future ADR explicitly revisits this principle.
- This decision does not, by itself, specify V1 scope or timelines — see `PRODUCT_VISION.md` and `ROADMAP.md`.

## Alternatives Considered

- **A narrower, industry-specific product** (a "yeshiva ERP" rather than a general platform with a yeshiva-shaped first module) — rejected, because it would require rebuilding the core for the next non-yeshiva customer, contradicting the platform-first goal already established in `PROJECT_VISION.md`.
- **A speed-first, "good enough" automation posture** (auto-apply suggestions above a confidence threshold) — rejected for V1 and for the foreseeable roadmap; revisiting this would require its own ADR with an explicit risk analysis, not a quiet drift over time.

## Follow-up Actions

- `docs/NERA_CONSTITUTION.md` Section 2 (Product Principles) and `docs/PRODUCT_VISION.md` Section 3 (Product Promise) restate this decision in full; keep both in sync with this ADR if either changes.
- Every future ADR that touches AI behavior, automation, or user-facing control must be checked against this ADR before being marked Accepted.
