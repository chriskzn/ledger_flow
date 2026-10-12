# Security policy

LedgerFlow is under development and is **not approved for production use**.

## Reporting a vulnerability

Please do **not** file a public issue containing exploit details, secrets or private customer data. Contact the repository maintainer privately through GitHub's **Report a vulnerability** feature (if enabled), or a private contact channel listed by the repository owner. Maintainers should configure a repository security advisory and a dedicated contact address before publicly launching the project.

## Supported versions

No release currently receives a production security-support guarantee. Do not use the current repository for live financial or payroll operations.

## Important operational notes

Keep server-side API credentials, MySQL accounts, and Supabase service-role keys out of the browser and source control. Use least-privilege database access, TLS, tested backups and environment-specific secrets. Never share real financial or payroll information in bug reports.
