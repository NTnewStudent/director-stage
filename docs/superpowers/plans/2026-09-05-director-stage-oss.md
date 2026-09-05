# Director Stage OSS Implementation Plan

> **For agentic workers:** Implement inline in this session. Spec: `docs/superpowers/specs/2026-09-05-director-stage-oss-design.md`.

**Goal:** Ship an Apache-2.0 monorepo with `@director-stage/core` as a React `<DirectorStage />` package, a static playground, three examples, API docs, and Docker/Render/Vercel deploy.

**Architecture:** Copy hjw director-stage + scene/pose data, cut canvas/upload. Public API is the React component + Host factory. Playground and examples consume workspace source. Docker serves the playground dist on `$PORT`.

**Tech Stack:** React 19, Vite 8, TypeScript, Three 0.185, R3F 9, drei 10, Zustand 4, Vitest, nginx.

## Global Constraints

- Do not modify `/Users/mac/Documents/hjwall`
- License Apache-2.0 on every package.json plus LICENSE + NOTICE
- Public exports only those listed in the spec
- `documentKey` not React `key`
- No class `new DirectorStage()` API
- No sessionStorage drafts
- Theme tokens copied unchanged
- Render listens on `$PORT`, not hardcoded 80

## File map

- Create: `packages/core/src/{index.ts,DirectorStage.tsx,host/*,i18n/*,theme/*}`
- Copy: scene libs, studio UI, tests, DESIGN.md, tokens, locales
- Create: `apps/playground`, `examples/01-react-mount`, `02-custom-storage`, `03-capture-record`
- Create: `docs/api.md`, Dockerfile, docker-compose.yml, render.yaml, vercel.json, README.md

## Tasks

1. Scaffold monorepo + Apache files + copy/rewrite imports
2. Host factory + error types + tests
3. Internal studio without canvas; public `<DirectorStage />`
4. i18n + theme inject
5. Rewrite studio tests to Host mocks
6. Playground + examples
7. docs/api.md + README
8. Docker / compose / render.yaml / vercel.json
9. `npm test` and `npm run build -w apps/playground`
