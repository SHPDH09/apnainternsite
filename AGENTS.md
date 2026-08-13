# AGENTS.md

Guidance for AI agents working in this repository.

## Product

Apna Intern (also referred to as EzyIntern in AWS/RDS code) is an internship management portal:

- Public site: registration, certificate verification, courses, universities
- Student dashboard
- Admin panel (directory, attendance, certificates, ID cards, live classes, payments, fees, notifications, assignments, and related tools)
- Staff dashboard (separate permission model from Admin)

Default local stack is **Express API + Vite frontend + local Postgres** (no `*.supabase.co`).

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Dev (API `:3000` + Vite `:8080`) | `npm run dev` |
| Frontend only | `npm run dev:frontend` |
| Tests | `npm test` (`vitest run`; currently needs `jsdom`, which is not in `package.json`) |
| Lint | `npm run lint` |
| Production frontend build | `npm run build` |

`npm run dev` requires `.env.awsrds.local` (gitignored). Copy `.env.awsrds.example` and set `DATABASE_URL`. Cloud Agent VMs use a local Postgres URL instead of AWS RDS.

## Local ports

| Service | Port |
| --- | --- |
| Vite frontend | 8080 |
| Express API / auth / rest / storage shim | 3000 |
| Local Postgres | 5432 |

Health: `GET http://127.0.0.1:3000/api/health`

## Cloud Agent notes

- Install is `npm ci` plus creating `.env.awsrds.local` when missing.
- Start brings up local Postgres (`pg_ctlcluster`) then `npm run dev`.
- Do not point Cloud Agents at production AWS RDS, S3, Razorpay, or SMTP unless the user explicitly provides those secrets.
- Do not remove Admin sidebar items; see `.cursor/rules/admin-sidebar-stability.mdc`.
- When pushing at the user’s request, follow `.cursor/rules/git-push-main.mdc`.
