# Contributing to LedgerFlow

Thanks for helping develop LedgerFlow.

1. Open an issue describing the problem, feature or proposed change before large refactors.
2. Use a focused branch and pull request; explain the change, its risk and any migration impact.
3. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for frontend changes. Run `cd backend && npm test` for backend changes.
4. Add tests for bug fixes, tenant isolation, authorisation, financial invariants and failed/retried transactions.
5. Never commit `.env` files, credentials, customer details, payroll records or production database dumps. Use synthetic fixtures.
6. Do not assert legal, SARS, accounting or payroll compliance without evidence and qualified review.
7. By contributing, you agree to license your contribution under the repository's MIT License and confirm you have rights to submit it.

Code review and passing mocked unit tests are **not** a production approval.
