# LedgerFlow production upgrade — status and next steps

## Scope completed in this package
- **MySQL 8 schema draft** in `mysql/001_schema.sql` for the twelve existing application tables plus `app_users`. **Not yet deployed or validated in MySQL.**
- **API permission checks** on the existing Supabase Edge Function: reject expired keys and enforce read/write/admin permissions; generic API writes restricted to validated customers and suppliers. Legacy API clients writing arbitrary financial tables will now receive 404.
- **Atomic manual journal posting**: new PostgreSQL RPC function and updated Journal screen. Install SQL migration first. Invalid/unbalanced journal lines raise an error and roll back the entire transaction.
- **2026/27 SARS tax bracket update** and correction to progressive-bracket calculation; unit tests added.

## Essential warning: MySQL migration is NOT complete
The frontend still uses `@supabase/supabase-js` for sign-in, queries, and writes. It cannot be pointed at MySQL. You need a server API, auth/session management, tenant-scoped database queries, data migration scripts, and rewiring of the React screens. Never expose MySQL credentials or privileged database access in the browser.

## Blockers before financial production
1. Invoice create / paid transactions and payroll paid / reverse postings still use multiple browser requests and can leave partial accounting state. Move to server-side ACID transactions with idempotency keys, row locking and unique constraints.
2. Payroll is **not legally production-ready**. Tax bands are updated, but medical credits, retirement fund deduction rules, SDL employer thresholds, COIDA caps/industry rates, age/ID handling, nonmonthly periods and payroll rounding require accountant/payroll specialist review and a rules engine keyed by effective tax date.
3. MySQL has no Supabase RLS. Every backend query must enforce tenant/user ownership and resource-scoped authorization. Add a real auth provider with password reset, MFA for administrators and server-side permissions.
4. Persisted money values should use DECIMAL and integer cents in application calculations; never rely on JS floating-point comparisons for balancing.
5. Add integration and end-to-end tests on a disposable MySQL database before switching production traffic.

## Recommended transition order
1. Back up current Supabase/Postgres database and run the frontend checks: `npm ci && npm test && npm run typecheck && npm run build`.
2. Provision a local MySQL 8 database with nonprivileged application account; review and apply `mysql/001_schema.sql`.
3. Implement backend authentication + scoped repositories + read-only endpoints and parity tests. Do not cut over authentication by replacing the Supabase URL.
4. Implement single-transaction journal, invoice, payment and payroll commands with debit/credit invariants, replay protection, and audit history; wire screens to these endpoints.
5. Develop repeatable export/import from Supabase with record counts, foreign-key verification, monetary control totals and parallel-run reconciliation.
6. Run security tests across two tenants and verify no read/write leaks. Test concurrency, rollbacks, retry/replay and failure recovery.
7. Get South African payroll rules signed off for the applicable tax year before processing real payslips.

## Verification classification
- Unit tests: see `tests/tax.test.mjs` and `npm test`.
- Supabase atomic SQL: source-reviewed, requires deployment and live Postgres tests.
- MySQL schema: starter draft, requires executing against MySQL and mapping from existing PostgreSQL rows.
- Financial end-to-end flows: **not validated**.

## Critical production test matrix
| Feature | Required checks |
|---|---|
| Auth/API | missing key 401; read-only write 403; expired key 401; owner isolation; malicious payload rejected |
| Journal | balanced posts; unbalanced rolls back; invalid account fails; no partial writes; reversal not deletion |
| Invoices | create with items and journal in one transaction; payment once; partial payment; retry/idempotency |
| Payroll | effective tax year; age bands; medical dependants; pension; UIF ceiling; approval lock; reversal |
| Accounting | trial balance zero; VAT reconciliation; fiscal date cutoffs; precision/rounding |
| Migration | table counts; FK integrity; tenant ownership; audit logs; parity with Postgres |
