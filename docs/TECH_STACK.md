# TECH_STACK.md

# Nera Technology Stack

Version: 1.0

Status: Approved

---

# Philosophy

Every technology must satisfy:

- Long-term maintainability
- High performance
- Strong community support
- Excellent developer experience
- Cloud readiness
- AI compatibility
- Enterprise readiness

Technology is selected for long-term stability rather than short-term popularity.

---

# Frontend

Framework:
Next.js 16 (App Router)

Language:
TypeScript

UI Library:
React 19

Styling:
Tailwind CSS 4

Component Library:
shadcn/ui

Icons:
Lucide

Forms:
React Hook Form

Validation:
Zod

Charts:
Apache ECharts

Calendar:
FullCalendar

PDF Generation:
React PDF

---

# Backend

Framework:
Next.js Route Handlers

Language:
TypeScript

ORM:
Prisma

Database:
PostgreSQL

Authentication:
Better Auth

Authorization:
CASL
plus Nera Permission Engine

Realtime:
Socket.IO

Background Jobs:
BullMQ

Cache:
Redis

Scheduler:
BullMQ

Storage:
MinIO (S3 Compatible)

Search:
PostgreSQL Full Text Search

Future Search Engine:
Elasticsearch

---

# AI Layer

Nera never depends on a single AI provider.

Every provider must be accessed through a unified AI Engine.

Supported providers:

- OpenAI
- Anthropic Claude
- Google Gemini
- Ollama
- Future providers

Business modules never communicate directly with AI providers.

---

# Infrastructure

Package Manager:
pnpm

Monorepo:
Turborepo

Containers:
Docker

CI/CD:
GitHub Actions

Secrets:
dotenv

Future Secret Management:
HashiCorp Vault

---

# Logging

Pino

---

# Monitoring

OpenTelemetry

Grafana

---

# Testing

Unit Testing:
Vitest

End-to-End Testing:
Playwright

---

# Repository Structure

apps/

packages/

modules/

docs/

scripts/

tools/

---

# Package Responsibilities

apps/
Application entry points.

packages/
Reusable platform capabilities.

modules/
Business functionality.

docs/
Architecture and documentation.

scripts/
Automation scripts.

tools/
Development tools.

---

# Shared Platform Packages

The platform is expected to contain reusable packages such as:

ui

database
auth

permissions

automation

notifications

ai

shared

These packages may evolve over time.

---

# Business Modules

Business functionality belongs only inside modules.

Examples:

CRM

Finance

Inventory

Projects

HR

Documents

Sales

Customers

Purchasing

Analytics

Future modules must follow the same architecture.

---

# Multi-Tenant

Every technology choice must support:

Tenant isolation

Organization configuration

Scalability

Future horizontal scaling

---

# AI Principles

AI is part of the platform.

It is not an external add-on.

Every module may use AI only through the platform AI Engine.

Changing AI providers must require configuration only.

No business code should depend on provider-specific SDKs.

---

# Future Technologies

New technologies may be added only after architecture approval.

Replacing existing core technologies requires an Architecture Decision Record (ADR).

---

# Final Rule

Long-term stability always wins over trends.
