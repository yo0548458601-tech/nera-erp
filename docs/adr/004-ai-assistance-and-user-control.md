# ADR-004 — AI Assistance and User Control

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

Nera's product promise ("the system feels like someone is working with me," "the system does not make mistakes," per ADR-001) implies AI will eventually play a real role — most concretely in the future invoice email-ingestion flow described in `PRODUCT_VISION.md` Section 7. AI is not implemented in V1. This ADR fixes the governing rules for AI _before_ any AI code exists, so that when AI Assistance is eventually built (post-V1, per `ROADMAP.md`), it is built to a standard already agreed on, rather than a standard invented under delivery pressure at that time. It also fixes how V1's own data model must be shaped now so that later AI work does not require breaking changes.

## Decision

1. **AI suggests, explains, warns, and provides confidence and evidence.** It does not silently act. Every AI output a user sees is accompanied by what it found, why, and how confident the system is, per `NERA_CONSTITUTION.md` Section 11 (Explainability Requirement).
2. **AI does not replace professional judgment.** It is an assistance layer, never an autonomous authority, per ADR-001's golden principle.
3. **Sensitive and irreversible business actions require explicit user approval before AI may cause them to happen.** There is no confidence threshold high enough to skip this requirement in V1 or in any currently-approved future milestone; changing that would require its own future ADR.
4. **User corrections and rejections must be preserved**, both as the immediate outcome (the AI's suggestion did not silently win) and as feedback data that could improve future suggestions.
5. **AI infrastructure is future work.** No AI provider, model, or inference code is introduced in Milestone 1 or Milestone 2/3 of the current roadmap. However, workflows and data models built now must already distinguish **proposed values** (a suggestion, whether AI-original or otherwise) from **confirmed values** (what a human has actually approved), so that AI can be introduced later by populating the proposed side of an already-existing distinction, not by redesigning the record.
6. Every AI action, once AI exists, executes as the requesting user and passes the same authorization checks and audit requirements a human action would (already established by ADR-008, Authorization Model; restated here as binding on AI Assistance specifically).

## Consequences

- V1's Invoices module (see `MODULE_MAP.md`) models a "confirmed" field set now, with a "proposed/extracted" field set reserved in the design, even though nothing populates it until AI Assistance exists. This is a deliberate, small amount of forward design, not a general license to add speculative fields elsewhere without a similar justified reason.
- No engine or module may add an "autonomous mode" for AI or automation that skips user approval on a sensitive or irreversible action, without a new ADR explicitly superseding this one.
- `ENGINE_MAP.md`'s AI Assistance entry (suggestion record: type, target, confidence, evidence, status, feedback) is the reference shape every future AI-touching feature designs against.

## Alternatives Considered

- **Defer all AI-related design until AI Assistance is actually built** — rejected. `PRODUCT_VISION.md`'s documented future invoice flow specifically requires Invoices' V1 data model to already support a proposed/confirmed distinction; waiting would mean a breaking migration later.
- **Allow AI to act autonomously above a confidence threshold, for low-risk actions only** — rejected for now as under-specified (what counts as "low-risk" is exactly the kind of judgment call ADR-001 reserves for the user); revisiting this requires a dedicated future ADR with a concrete risk model, not a default assumption baked in here.

## Follow-up Actions

- `NERA_CONSTITUTION.md` Section 5 (AI Principles) and `PRODUCT_VISION.md` Section 7 (AI Vision) restate this decision; keep both in sync with this ADR if it changes.
- When AI Assistance is scheduled (post-V1, per `ROADMAP.md` Section 7), that sprint's design must be checked against this ADR before implementation begins, and any deviation requires a superseding ADR, not a silent departure.
- The Integration Engine work needed to feed AI Assistance (email ingestion, document extraction) is governed separately by ADR-005.
