# Mission Control

A high-density SaaS customer journey monitoring platform for telecom and enterprise operators. Monitor, manage, and debug customer lifecycle flows in real-time — with RBAC, multi-tenancy, configurable data source connectors, and a visual flow canvas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/mission-control run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth keys

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Radix UI, Wouter routing
- Auth: Clerk (`@clerk/react`, `@clerk/express`)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — canonical OpenAPI spec (source of truth for all routes + types)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (run codegen to update)
- `lib/db/src/schema/` — Drizzle ORM table definitions
  - `tenants.ts`, `users.ts`, `data-sources.ts`, `journeys.ts`, `journey-nodes.ts`, `activity.ts`
- `artifacts/api-server/src/routes/` — Express route handlers, one file per domain
- `artifacts/mission-control/src/pages/` — React page components
- `artifacts/mission-control/src/components/` — Shared UI components (layout, ui primitives)

## Architecture decisions

- **Contract-first API**: OpenAPI spec defined first; routes and client hooks generated from it. Never hand-write client API calls.
- **Multi-tenancy via `tenant_id`**: Every core table carries a `tenant_id` FK. Clerk org/user maps to a tenant row.
- **Clerk proxy**: The Clerk JS SDK is proxied through the Express API at `/api/__clerk` to enable custom domain auth flows.
- **Row-level RBAC**: User roles (`superadmin`, `admin`, `operator`, `viewer`) stored in DB; enforced per-route in middleware.
- **No `/api` prefix in route files**: The root router already mounts at `/api`; individual route files use bare paths.

## Product

- **Dashboard**: Live summary stats (active journeys, connected sources, health status, suspended count) + activity feed
- **Journeys**: Searchable list of customer journey instances with status/health badges; suspend/resume actions
- **Journey Detail**: Visual SVG flow canvas showing node execution path with system integrations (Salesforce, Matrixx, Oracle, etc.)
- **Data Sources**: CRUD connectors for Athena, Oracle, PostgreSQL, MySQL, BigQuery, Snowflake with live connection testing
- **Activity Log**: Filterable audit trail of all platform events
- **Users & Tenants**: Admin views for user management and tenant administration
- **Settings**: User profile and preferences

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` after editing `lib/db/src/schema/` — the composite lib must be rebuilt first.
- Do not run `pnpm run dev` at workspace root — no root dev script exists by design.
- The `PORT` env var is injected by the workflow system; never hard-code it.
- Codegen output paths: `lib/api-client-react/src/generated/api.ts` (hooks), `lib/api-client-react/src/generated/model/` (types), `lib/api-client-react/src/generated/zod/` (Zod schemas).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `lib/api-spec/openapi.yaml` for all defined endpoints
