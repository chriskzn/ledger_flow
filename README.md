# LedgerFlow

**Open-source accounting and payroll software for South African businesses.**

LedgerFlow is an early-stage React application covering customer and supplier records, invoicing, journals, accounts, reporting, payroll, and South African tax-related workflows. It also contains a **separate, experimental MySQL-backed accounting API** intended to support a future migration away from direct browser-to-Supabase data access.

> [!WARNING]
> **Not production ready.** The frontend still uses Supabase; the MySQL API does not yet implement the full application. Financial workflows, payroll compliance, data migration, security, and disaster recovery have not been independently verified. **Do not use this repository to process real financial or payroll data without completing the release gates.**

## Features and current maturity

| Area | Current state |
| --- | --- |
| Dashboard, customers, suppliers and chart of accounts | React screens implemented; Supabase-backed |
| Invoices, journals and reporting | React screens implemented; Supabase-backed |
| Employees, payroll and SARS screens | Implemented in frontend; compliance and full integration not validated |
| MySQL accounting API | Separate backend: create journals, invoices and invoice payments |
| Transaction safety | MySQL commands use InnoDB transactions and idempotency keys |
| Automated tests | Frontend-side unit tests and mocked backend-domain unit tests exist |
| Browser/MySQL end-to-end parity | **Not implemented** |

## Technology

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS
- **Current authentication and frontend data source:** Supabase
- **New accounting backend:** Node.js 22 and `mysql2`
- **Target relational database:** MySQL 8 with InnoDB
- **Tests:** Node.js built-in test runner

## Repository structure

```text
src/                 React screens, components, authentication and helpers
supabase/            Existing Supabase functions and database migrations
backend/             Separate MySQL accounting API and domain tests
mysql/               MySQL schema and hardening migration
tests/               Application-level unit tests
PRODUCTION_UPGRADE.md         Earlier upgrade notes
PHASE4_RELEASE_READINESS.md   Current limitations and release gates
LICENSE              MIT licence
```

## Getting started (development only)

### Requirements

- Node.js 22 or newer and npm
- A **development** Supabase project for running the existing frontend
- MySQL 8 for developing and testing the separate accounting API

### Frontend

```bash
npm ci
cp .env.example .env  # or create .env manually with the two variables below
npm run dev
```

Configure the following values in the root `.env` file (from a **test** project):

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

These `VITE_` values are exposed to the browser. **Never put Supabase service-role keys, MySQL passwords, or server-side API tokens in frontend environment variables.**

Run checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The frontend **does not use MySQL yet**: the MySQL API runs separately, and its credentials must not be exposed to the browser.

### MySQL accounting API (development only)

1. Create a disposable MySQL 8 database and a least-privileged application user.
2. Apply `mysql/001_schema.sql`, then `mysql/002_hardening.sql` **to that new database**. Review the scripts before running them; do not apply them against existing production data.
3. Fill in the variables in `backend/.env.example` using your deployment tool or local environment. Node does not automatically load this example file.
4. Start and test the backend:

```bash
cd backend
npm install
npm test
npm start
```

The API binds to `127.0.0.1:8080` by default. Deploy it only behind a configured TLS reverse proxy. Its `POST` routes require a server-side bearer credential and an `Idempotency-Key`; they are **not** intended for direct calls from a public browser. Details are in [`PHASE4_RELEASE_READINESS.md`](PHASE4_RELEASE_READINESS.md).

### Available API commands

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health/live` | Process liveness |
| `GET` | `/health/ready` | Database reachability |
| `POST` | `/v1/journals` | Post a balanced journal |
| `POST` | `/v1/invoices` | Create invoice and corresponding journal |
| `POST` | `/v1/invoices/:id/payments` | Record a payment and corresponding journal |

These routes are partial foundations, **not** a stable public API contract.

## Roadmap to production readiness

- [ ] Replace browser-to-Supabase data access with an authenticated, tenant-isolated MySQL backend (including secure user sessions)
- [ ] Migrate **all** frontend features and reporting workflows; prove feature parity
- [ ] Build and validate a repeatable Supabase-to-MySQL data migration and reconciliation process
- [ ] Run real MySQL integration, concurrency, rollback and browser end-to-end tests
- [ ] Verify accounting corrections, immutable audit history and reversal workflows
- [ ] Have qualified South African specialists validate PAYE/UIF/SDL/VAT and effective-date handling
- [ ] Add CI/CD, TLS, secret rotation, backups and **tested** disaster recovery
- [ ] Complete external security and financial-controls review before a live rollout

See [`PHASE4_RELEASE_READINESS.md`](PHASE4_RELEASE_READINESS.md) for detailed release blockers and acceptance criteria.

## Contributing

Contributions are welcome, especially around secure authentication, MySQL integration, automated testing, financial correctness, accessibility and documentation. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Please do **not** include real customer, payroll or financial data in issues or tests.

## Security

Do **not** post suspected vulnerabilities, credentials, or personal data in public issues. See [`SECURITY.md`](SECURITY.md) for reporting guidance. Before publishing a fork, review commit history, configuration, fixtures and deployment files for secrets and private information.

## Licence

Released under the [MIT License](LICENSE). Copyright (c) 2026 LedgerFlow contributors. Before publishing, confirm that you have permission to relicense **all** project code, design assets and dependencies, and update the copyright holder if required. MIT licensing does not establish product or company trademark rights.

> **No warranty:** This project is provided as-is and is not a substitute for professional accounting, tax, payroll or security advice.
