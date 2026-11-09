# ADR-0003: Keycloak for authentication (make or buy)

- Status: proposed (not yet implemented in the prototype)
- Date: 2026-11-08

## Context and Problem Statement
Saved projects, customer-specific pricing and internal tools need authentication and roles (installer, sales, admin). Partner SSO may follow. Do we build auth, buy SaaS or run an open-source IdP?

## Decision Drivers
- Security: auth is high-risk and not our core domain
- Standards: OAuth2 / OIDC, SSO, MFA
- Data residency (EU) and GDPR
- Total cost of ownership and lock-in
- Team capacity

## Considered Options
1. **Make** – custom auth in Django (sessions/JWT, own user management)
2. **Buy (SaaS)** – Auth0 / Okta / Entra ID
3. **Adopt open source** – self-hosted Keycloak

## Make-or-Buy Assessment
| Criterion | Make | SaaS | Keycloak |
|---|---|---|---|
| Time to first login | weeks | days | days |
| Security risk | high (own code) | low | low (mature, CVE process) |
| OIDC/SSO/MFA | must build | yes | yes |
| EU data residency | yes | depends on plan | yes (self-hosted) |
| License cost | none | per MAU, grows | none |
| Ops effort | low–medium | none | medium (HA, upgrades, DB) |
| Lock-in | none | high | low (standard OIDC) |
| Differentiation | none | none | none |

Auth does not differentiate a PV configurator → do not **make**. Between buy options, Keycloak wins on data residency, cost at scale and low lock-in; the ops effort fits a team that already runs Kubernetes.

## Decision Outcome
Chosen: **Option 3, Keycloak**, deployed via the Keycloak Operator. Django (DRF) validates OIDC access tokens (JWT, JWKS); the React app uses Authorization Code + PKCE. Roles come from realm/client roles.

### Consequences
- Good: standards-based, SSO/MFA out of the box, swappable for SaaS later because clients only speak OIDC.
- Bad: we own upgrades, backups and HA of Keycloak and its database.
- Revisit if ops cost exceeds SaaS cost or if the company standardises on Entra ID.
