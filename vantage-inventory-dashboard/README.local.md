# Vantage — Inventory Operations Dashboard

A live inventory operations dashboard built with **TanStack Start (React 19)** + **Vite 7**, styled with **Tailwind CSS v4**, backed by a **Supabase** (Lovable Cloud) Postgres table. Edit real stock quantities and restock dates inline, track low-stock alerts, and watch KPIs update from the database in real time.

> Design direction: **Editorial split panels** — dark navy surfaces, amber/teal/rose accents, Oswald + IBM Plex Sans/Mono typography.

---

## Quick start (local)

```bash
# 1. install deps (bun recommended; npm/pnpm work too)
bun install        # or: npm install

# 2. configure environment
cp .env.example .env
#   → fill in your own Supabase project URL, ref, and publishable (anon) key

# 3. start the dev server
bun run dev        # or: npm run dev
```

Open `http://localhost:8080` (the dev server prints the exact URL).

---

## Environment variables

See `.env.example`. **None of these are secret** — the publishable/anon key is designed to ship to the browser; row-level security on the database is what protects data.

| Variable                        | Where used     | Notes                         |
| ------------------------------- | -------------- | ----------------------------- |
| `SUPABASE_URL`                  | server runtime | `https://<ref>.supabase.co`   |
| `SUPABASE_PROJECT_ID`           | server runtime | project ref                   |
| `SUPABASE_PUBLISHABLE_KEY`      | server runtime | anon/publishable key          |
| `VITE_SUPABASE_URL`             | browser bundle | same value, exposed to client |
| `VITE_SUPABASE_PROJECT_ID`      | browser bundle | same value                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser bundle | anon/publishable key          |

Never put service-role keys or `LOVABLE_API_KEY` in a `VITE_` variable — those are server-only.

---

## Database

The schema lives in `supabase/migrations/`. The single table:

```sql
CREATE TABLE public.inventory_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  dock            TEXT NOT NULL DEFAULT 'Dock 1',
  category        TEXT NOT NULL DEFAULT 'General',
  on_hand         INTEGER NOT NULL DEFAULT 0,
  reorder_point   INTEGER NOT NULL DEFAULT 25,
  restock_date    DATE,
  last_counted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Grants + RLS allow anonymous and authenticated read/write (this is a shared demo board; tighten the policies for production). A trigger keeps `updated_at` fresh. The migration also seeds 8 demo SKUs.

To recreate the table on your own Supabase project, run the SQL in `supabase/migrations/*.sql` against your database (SQL editor / `psql`).

---

## Project structure

```
.
├─ public/                     # favicon, robots
├─ supabase/
│  ├─ config.toml
│  └─ migrations/               # schema + seed SQL
├─ src/
│  ├─ components/ui/            # shadcn-style reusable primitives (button, card, dialog, …)
│  ├─ hooks/use-mobile.tsx
│  ├─ integrations/supabase/    # auto-generated Supabase clients + auth middleware (do not hand-edit)
│  ├─ lib/
│  │  ├─ inventory.ts           # typed models, status logic, CRUD helpers
│  │  ├─ utils.ts
│  │  ├─ error-capture.ts, error-page.ts, lovable-error-reporting.ts
│  ├─ routes/
│  │  ├─ __root.tsx             # root layout, fonts, global metadata
│  │  └─ index.tsx              # the dashboard page (KPIs, table, alerts, chart, add/edit)
│  ├─ routeTree.gen.ts          # auto-generated route tree (do not hand-edit)
│  ├─ router.tsx
│  ├─ server.ts, start.ts       # TanStack Start app entry
│  └─ styles.css                # Tailwind v4 theme tokens + typography
├─ .env.example
├─ package.json, bun.lock
├─ vite.config.ts, tsconfig.json
├─ components.json, eslint.config.js, .prettierrc
└─ README.md
```

### Key files

| Purpose                                                                                                                                 | File                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Dashboard UI (KPIs, searchable inventory table, inline row editor, add-SKU form, low-stock alerts, recent orders, stock-movement chart) | `src/routes/index.tsx`                                    |
| Inventory data models, status calc, Supabase CRUD                                                                                       | `src/lib/inventory.ts`                                    |
| Database schema + seed data                                                                                                             | `supabase/migrations/*.sql`                               |
| Design tokens, colors, fonts, responsive rules                                                                                          | `src/styles.css`                                          |
| Root layout + Google Font links + metadata                                                                                              | `src/routes/__root.tsx`                                   |
| Supabase clients (auto-generated)                                                                                                       | `src/integrations/supabase/client.ts`, `client.server.ts` |

---

## Tech stack

- **TanStack Start v1** (React 19, SSR) + **TanStack Router** + **TanStack Query**
- **Vite 7**
- **Tailwind CSS v4** (native `@import` + `@theme` tokens, no `tailwind.config.js`)
- **Supabase** Postgres + RLS
- **lucide-react** icons, **Oswald / IBM Plex Sans / IBM Plex Mono** fonts

---

## Scripts

```bash
bun run dev        # dev server (HMR)
bun run build      # production build
bun run start      # serve the built app
bun run typecheck  # tsgo typecheck
```

---

## Notes

- This bundle excludes `node_modules`, `.git`, and the real `.env` (copy from `.env.example`).
- The reusable UI primitives in `src/components/ui/` are shadcn-style components; only some are used by the dashboard, but all are included for reuse.
- Responsive: the dashboard reflows to a single column under `lg`, KPI cards collapse to 2-up, and the filter row scrolls horizontally on narrow screens.
