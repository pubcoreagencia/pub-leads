# Repository Guidelines

## Project Overview

LeadCore is a B2B SaaS for prospecting, CRM, pipelines, AI messaging, manual WhatsApp outreach, and billing. Build a clean, premium UI: white base, purple primary, and gold only for lifetime plans. Do not copy third-party brands, logos, layouts, text, or assets.

## Required Stack

Use Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, lucide-react, Supabase Auth/PostgreSQL/client, React Hook Form, Zod, dnd-kit, and Recharts.

## Project Structure & Module Organization

Prefer this structure:

```text
app/         pages, layouts, route handlers
components/  reusable UI components
config/      menus, plans, cards, navigation arrays
lib/         utilities and typed helpers
services/    Supabase, Overpass, AI, WhatsApp, Billing
schemas/     Zod schemas and types
hooks/       reusable React hooks
tests/       unit, integration, component tests
```

Keep heavy logic out of visual components. Use `services/` for integrations and `config/` arrays for menus, plans, cards.

## Product Rules

Do not scrape Google Maps directly. Use OpenStreetMap/Overpass API first. Keep architecture ready for CSV upload, Google Places API, and WhatsApp Cloud API.

For MVP WhatsApp, use only `wa.me` links with prefilled messages.

## Build, Test, and Development Commands

Use these once `package.json` exists:

- `npm run dev`: start development.
- `npm run lint`: run lint checks.
- `npm run build`: validate production build.
- `npm test`: run tests when configured.

Run lint/build after meaningful changes when possible.

## Coding Style & Naming Conventions

Write modular, strongly typed TypeScript. Use reusable components, explicit props, and Zod for forms, API inputs, and external data. Include loading states, empty states, and success/error toasts.

Use PascalCase for components, camelCase for functions/variables, and kebab-case for routes. Avoid duplication and oversized files.

## Testing Guidelines

Test schemas, services, billing, lead parsing, CRM workflows, and drag-and-drop. Prefer fixtures over live API calls. Mock Supabase, Overpass, AI, WhatsApp, and billing.

## Commit & Pull Request Guidelines

Use concise Conventional Commit messages, such as `feat: add lead pipeline board`.

PRs need a summary, testing notes, linked issues, and screenshots for UI changes. Mention env vars, migrations, rate limits, or integration assumptions.

## Agent Workflow

Before implementing any large step:

1. Explain the plan.
2. List files to create or change.
3. Implement.
4. Run lint/build when possible.
5. Finish by explaining what changed and which commands the user should run.

## Security & Configuration

Never commit secrets, API keys, cookies, private scraped data, or Supabase service-role keys. Use `.env.local` and keep safe examples in `.env.example`.
