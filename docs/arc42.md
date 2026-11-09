# K2 Base Lite – Architecture Documentation (arc42, condensed)

> Status: prototype / job-application demo. Not a product, not affiliated with K2 Systems.

## 1. Introduction and Goals
A small web configurator for pitched-roof PV mounting systems: the user enters a panel grid and site parameters, sees a 3D preview and gets a bill of materials (BOM) plus a simplified load hint.

Quality goals (top 3):
1. **Correctness / traceability** – one source of truth for calculations, covered by tests.
2. **Maintainability** – clear module boundaries, ADRs for decisions.
3. **Deployability** – reproducible containers, CI, Kubernetes manifests.

Stakeholders: installers (end users), sales/engineering (BOM accuracy), developers/ops.

## 2. Constraints
- Stack: Django + DRF, React (Vite) + react-three-fiber, Docker, Kubernetes.
- No real catalog data; item numbers are `EXAMPLE-` placeholders.
- Load check is a simplified heuristic, **not** a certified EN 1991 calculation.
- Built in a few days by one developer.

## 3. Context and Scope
- **User** (browser) → **Frontend SPA** → `POST /api/calculate/` → **Backend**.
- Out of scope: ERP/PIM integration, ordering, user accounts (planned via Keycloak, ADR-0003), certified statics.

## 4. Solution Strategy
- Stateless calculation service in Django (ADR-0001); frontend renders only.
- 3D preview with react-three-fiber (ADR-0002).
- Shared geometry constants documented in `CONTRACT.md`, tested on both sides.
- Container-first: same images run in docker compose and Kubernetes.

## 5. Building Block View
- **frontend/**: form, 3D scene, result/BOM table, API client.
- **backend/**: `calculate` endpoint (DRF serializer for validation), pure-Python calculation module (geometry, BOM, load check), `health` endpoint.
- **infra/k8s/**: namespace, deployments, services, ingress, HPA.

## 6. Runtime View
1. User changes inputs → frontend updates 3D preview locally (geometry only).
2. On submit, frontend posts inputs to `/api/calculate/`.
3. Serializer validates; calculation module returns totals, BOM, load status.
4. Frontend renders BOM and load hint with disclaimer. 400 → field errors shown at the form.

## 7. Deployment View
- Local: `docker compose up` (backend :8000, nginx frontend :8080).
- Kubernetes: Ingress routes `/api` → backend Service, `/` → frontend Service; backend scales 2–6 via HPA; probes on `/api/health/`.
- CI (GitHub Actions): lint + tests for both parts, image builds on `main`.

## 8. Cross-cutting Concepts
- **Validation**: DRF serializers at the boundary; ranges from `CONTRACT.md`.
- **Testing**: pytest for calculation and API, vitest for frontend logic.
- **Configuration**: 12-factor env vars; ConfigMap/Secret in Kubernetes.
- **Security** (planned): OAuth2/OIDC via Keycloak, JWT validation in DRF.
- **Observability** (planned): structured logs, Prometheus metrics.

## 9. Architecture Decisions
- [ADR-0001](adr/0001-calculation-in-backend.md) Calculation in backend
- [ADR-0002](adr/0002-react-three-fiber-for-3d.md) react-three-fiber for 3D
- [ADR-0003](adr/0003-keycloak-for-auth-make-or-buy.md) Keycloak for auth (make or buy)

## 10. Quality Requirements
- Same input → same output (deterministic, unit tested).
- API response < 200 ms for max grid (20 × 30).
- Every invalid input yields a 400 with a field-level message.
- A new developer runs the full stack with one command.

## 11. Risks and Technical Debt
- Simplified load model could be mistaken for real statics → disclaimer in API and UI.
- Geometry constants duplicated in frontend (preview) and backend → contract tests; long term serve them from an API.
- No persistence, auth or audit trail yet.
- Demo Secret in manifests.

## 12. Glossary
- **BOM** – bill of materials.
- **kWp** – kilowatt peak, nominal PV power.
- **Rail** – aluminium profile carrying the panels; 4.40 m bars cut/joined on site.
- **Wind/snow zone** – simplified regional load classes (inspired by EN 1991, not equivalent).
