# LedgerFlow — Phase 4 MySQL backend implementation

**Status: engineering candidate; NOT approved for production financial or payroll use.**

## Implemented in this deliverable
- Independent Node 22 MySQL backend under `backend/` (requires `mysql2` installation).
- Tenant scope from server-side API key record, not user-controlled request fields.
- SHA-256 API-key lookup, expiry / active / write-permission enforcement, constant-time hash match.
- `POST /v1/journals`: journal lines are checked for balancing, account tenancy and activity; header, lines and audit event saved together in one InnoDB transaction.
- `POST /v1/invoices`: customer ownership checked; draft invoice, line items, balancing AR/revenue/VAT journal and audit event saved together.
- `POST /v1/invoices/:id/payments`: invoice row locked; partial or full receipt and corresponding bank/AR journal and audit event saved together.
- `Idempotency-Key` enforced for POST commands. Repeating a committed command returns the same entity ID and does not double-post.
- MySQL hardening migration includes tenant/code unique constraints, invoice-number uniqueness, operation replay ledger and audit trail.
- Unit tests for money parsing, invalid dates/keys, transactional rollback, journal validation and invoice/payment restrictions.

## Critical deployment blockers (must resolve before production launch)
1. **Frontend NOT migrated.** The React app still signs in and makes data calls through Supabase. The new MySQL API is a separately runnable backend; no cutover should be attempted until all pages and auth are rewired, including payroll and reporting. Do not put API keys in browser bundles or client-side storage. Use a secure user session backend with HttpOnly cookies, authorization and CSRF checks, distinct from server-to-server API keys.
2. **No running MySQL was available for live integration tests.** `mysql/001_schema.sql` and `002_hardening.sql` must be applied to a fresh disposable MySQL 8 instance and validated, including SQL compatibility, privileges, transaction rollback, concurrent calls and schema performance.
3. **No data migration pipeline provided.** Build Supabase-to-MySQL export/import with a consistent cutover snapshot, UUID and foreign-key preservation, test against representative data, reconcile table counts and GL balances and supply rollback plan.
4. **Money and VAT restrictions.** New invoice API deliberately supports only *integer quantities* and VAT rates of 0% or 15%. Financial/tax professionals must approve the rounding method, zero-rated vs exempt treatment, corrections, fiscal locks, reversal workflows and chart-of-account rules. The legacy browser permits broader inputs, so parity is not complete.
5. **Payroll not production-safe.** SARs bracket updates alone do not cover legislated PAYE, UIF, SDL, medical credits and all edge cases. No payroll posting endpoint was migrated.
6. **No E2E/security audit** or disaster-recovery validation; configure MFA, monitoring, backup/recovery tests, strict SQL privileges, TLS, request rate limits, key rotation and security headers.
7. **No deployment has been performed.** No CI infrastructure, real credentials or DNS/TLS provisioned. Do not set LIVE or PROD as a marketing label until quality gates pass.
8. **No journal reversal feature in new backend.** Do not delete posted journals. Implement explicit opposite-entry reversals with permissions and immutable audit.

## Local backend setup (non-production)
1. Install Node 22+, MySQL 8 and apply `mysql/001_schema.sql` followed by `mysql/002_hardening.sql` on a newly created empty schema.
2. Create a restricted DB account; inject secret environment variables from `backend/.env.example`. Never include `.env` files in version control.
3. `cd backend && npm install && npm test` then `npm start`. API binds to `127.0.0.1:8080` (place behind an authenticated TLS reverse proxy).
4. For a *server-to-server* API credential, create an `api_keys` record with a random `lf_` + 64-hex-character token, `key_prefix` equal to its first 11 characters, `key_hash` equal to hex SHA-256 of the full token, `permissions` equal to JSON `["write"]`, an active status and an expiry. Issue and store credentials only through a protected administrative interface/secrets manager. This process is **not** suitable for embedding a token in React.
5. `POST` application/json to `/v1/journals`, `/v1/invoices`, `/v1/invoices/<UUID>/payments` with `Authorization: Bearer <token>` and a unique `Idempotency-Key` (12–128 alphanumeric, underscore or hyphen). All amounts are fixed-two-decimal strings for predictable results.

## Suggested next release gates
| Gate | Acceptance |
|---|---|
| MySQL runtime | Migrations verified, strict grants, retry/deadlock handling, unique constraints, backups restored |
| Identity | Browser session auth implemented; MFA and tenancy tested; zero server secrets exposed |
| Feature parity | Customers, suppliers, accounts, journals, invoices, payroll, VAT, reports and settings use MySQL-backed endpoints |
| Ledger integrity | GL reconciles after writes, failed writes, double retries, concurrent payments and reversals |
| Data migration | Consistent snapshot, counts/FKs/totals compare, auditable cutover + rollback tested |
| Payroll/legal | South African payroll and tax specialist signs off scenarios and effective dates |
| Operations | TLS, CI/CD, alerts, audit retention, incident plan, secrets rotation, DR exercise |

## Test evidence
- `node --test backend/tests/*.test.mjs`: 10 / 10 PASS (mock DB; **not** MySQL integration tests).
- Prior project test suite remains in `/tests` and can be rerun with root `npm test`.
- No full frontend build, real database, penetration test or deployment validation performed in this environment.

See the previous `PRODUCTION_UPGRADE.md` for the original issues and remaining scope.
