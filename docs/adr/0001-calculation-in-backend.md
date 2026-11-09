# ADR-0001: Calculation logic lives in the backend

- Status: accepted
- Date: 2026-11-08

## Context and Problem Statement
BOM, power and load results must be correct, testable and later reusable by other clients (ERP, sales tools). Where should the calculation run?

## Decision Drivers
- Single source of truth for engineering rules
- Testability and auditability
- Protecting business logic
- Reuse by non-browser clients

## Considered Options
1. Calculation in the backend (Django service)
2. Calculation in the frontend (TypeScript)
3. Both, kept in sync

## Decision Outcome
Chosen: **Option 1**. The backend owns all calculations; the frontend renders geometry for the preview only.

### Consequences
- Good: one tested implementation, versionable API, reusable by other systems.
- Good: rules are not exposed in shipped JS.
- Bad: network round-trip per calculation; preview geometry constants are duplicated (mitigated by `CONTRACT.md` and tests).

## Pros and Cons of the Options
- **Frontend only** – instant feedback, but logic duplicated for every other client and hard to audit.
- **Both** – best UX, highest drift risk; revisit only if latency becomes a problem (e.g. shared WASM/rule engine).
