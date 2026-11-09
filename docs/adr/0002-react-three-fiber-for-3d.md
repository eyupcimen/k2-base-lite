# ADR-0002: react-three-fiber for the 3D preview

- Status: accepted
- Date: 2026-11-08

## Context and Problem Statement
Users need a 3D preview of the panel layout on a tilted roof. The UI is React. Which 3D approach?

## Decision Drivers
- Fits React's declarative model and state flow
- Mature ecosystem, low bundle impact for a simple scene
- Testable components, easy onboarding

## Considered Options
1. react-three-fiber (+ drei) on top of three.js
2. Plain three.js with imperative code
3. Babylon.js
4. Commercial CAD/BIM viewer SDK

## Decision Outcome
Chosen: **Option 1**. Scene is a function of form state; components (Roof, PanelGrid, Rails) map 1:1 to domain objects.

### Consequences
- Good: no manual scene sync, reuse of React patterns and tooling.
- Good: full three.js available when needed.
- Bad: extra abstraction layer; very large scenes need instancing (`InstancedMesh`) and profiling.

## Pros and Cons of the Options
- **Plain three.js** – full control, but imperative sync code with React state.
- **Babylon.js** – strong engine, weaker React integration.
- **CAD SDK** – needed later for real BIM/DWG export; license cost and lock-in not justified for a preview.
