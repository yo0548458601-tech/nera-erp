# DEVELOPMENT.md

# Nera Development Standards

**Version:** 1.0  
**Status:** Approved

---

# 1. Purpose

This document defines the development standards for Nera Platform.

Every contributor, human or AI, must follow these rules.

These standards exist to protect long-term maintainability, consistency and architecture quality.

---

# 2. Development Philosophy

Nera is built for long-term growth.

Development must prioritize:

- Clarity
- Maintainability
- Stability
- Security
- Architecture consistency
- Predictable structure

Speed is valuable only when it does not damage the architecture.

---

# 3. Roles

## Product Owner

Defines business requirements and priorities.

## Chief Architect

Defines architecture, reviews technical decisions and protects long-term maintainability.

## Lead Developer

Implements approved tasks, raises concerns and produces clean code.

Claude Code is treated as a Lead Developer, not as a product decision maker.

---

# 4. Sprint Workflow

Every sprint follows this flow:

1. Planning
2. Execution
3. Review
4. Approval
5. Commit

No sprint is complete until the changes are reviewed and committed.

---

# 5. Task Rules

Every task must include:

- Objective
- Scope
- Constraints
- Deliverables
- Acceptance Criteria

Claude must not implement anything outside the approved scope.

If the task is unclear, Claude must stop and ask.

---

# 6. Code Language

All code must be written in English.

This includes:

- File names
- Folder names
- Variables
- Functions
- Classes
- Types
- Interfaces
- API routes
- Database names
- Comments

Hebrew is used only for user-facing UI text.

---

# 7. UI Language

The user interface is Hebrew-first.

All user-facing text must be Hebrew.

The UI must support full RTL from day one.

Future localization must be possible without rewriting the architecture.

---

# 8. Code Quality

Code must be:

- Simple
- Explicit
- Readable
- Modular
- Testable
- Maintainable

Avoid clever abstractions unless they clearly reduce long-term complexity.

---

# 9. File Structure

Files should be small and focused.

A file should have one clear responsibility.

Large files must be split when they become difficult to understand.

Business logic should not be hidden inside UI components.

---

# 10. Naming Rules

Names must be clear and consistent.

Use domain terminology approved in project documentation.

Do not invent synonyms for established concepts.

Prefer explicit names over short names.

---

# 11. Architecture Compliance

All development must follow:

- PROJECT_VISION.md
- ARCHITECTURE.md
- DEVELOPMENT.md
- CLAUDE.md

If a requested implementation conflicts with architecture, stop and request review.

Architecture wins over convenience.

---

# 12. Module Boundaries

Business modules must remain independent.

A module must not import another module’s internal code.

Shared capabilities belong in Core Engines.

Duplicated infrastructure is not allowed.

---

# 13. AI-Assisted Development Rules

Claude may:

- Suggest improvements
- Identify risks
- Explain alternatives
- Implement approved tasks

Claude may not:

- Invent product requirements
- Make architectural decisions alone
- Expand scope without approval
- Add unrequested features
- Modify unrelated files

---

# 14. Review Rules

Every change must be reviewed before approval.

Review must check:

- Scope compliance
- Architecture compliance
- File changes
- Naming
- Security
- Simplicity
- Maintainability

No change is approved only because it works.

---

# 15. Git Rules

Commits must be small and meaningful.

Each commit should represent one logical change.

Commit messages should use this format:

type: short description

Examples:

- chore: initialize repository foundation
- docs: add project vision
- docs: add architecture standards
- feat: add authentication foundation
- fix: correct tenant isolation check

---

# 16. Branch Rules

The main branch is named:

main

The main branch should always remain stable.

Future feature work should be done in feature branches when needed.

---

# 17. Documentation Rules

Documentation is part of the product.

Every important system decision must be documented.

Every Core Engine must have documentation.

Every Business Module must have documentation.

Outdated documentation is considered a defect.

---

# 18. Security Rules

Never trust the client.

Authorization must be enforced server-side.

Tenant isolation is mandatory.

Sensitive data must not be exposed in logs, UI state or client-side storage.

Security shortcuts are not allowed.

---

# 19. Configuration Rules

Prefer configuration over hardcoded behavior.

If behavior may differ between tenants, organizations or users, it should be configurable.

Hardcoded tenant-specific behavior is forbidden.

---

# 20. Testing Philosophy

Testing exists to protect confidence.

Critical logic must be testable.

Business rules, permissions, workflows, automation and tenant isolation require special testing attention.

---

# 21. Error Handling

Errors must be clear, intentional and safe.

Do not expose internal details to users.

User-facing errors must be understandable.

Developer-facing errors must contain enough context for debugging.

---

# 22. Performance

Do not optimize prematurely.

Do not write code that clearly cannot scale.

Prefer simple solutions that can evolve.

Performance decisions must be based on actual needs or clear architectural risk.

---

# 23. Definition of Done

A task is done only when:

- The requested scope is completed
- No unrelated changes were made
- The implementation follows architecture
- The code is readable
- The documentation is updated when needed
- The change was reviewed
- The change was committed

---

# 24. Final Rule

Nera should become easier to maintain as it grows.

Any development habit that makes the system harder to understand, extend or secure is not allowed.
