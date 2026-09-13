# PDFAlarm Engine launch plan

Owner: ads-dotcom. Started: 2026-09-13. Initial public release: v0.1.0.

## Acceptance criteria

- Standalone typed engine, no application database/auth/billing dependencies.
- Turkish/Latin/Greek/Cyrillic font embedding, wrapping and explicit unsupported glyph errors.
- Tables wrap and paginate with repeated headers; no silent truncation.
- QR quiet zone, Code 128/EAN-13 barcodes, explicit asset handling, overlay support.
- Runtime schema validation and configurable input/output/resource limits.
- Real PDF regression tests, examples, package installation check and CI.
- Accessible responsive landing page, local browser playground and downloadable examples.
- Public MIT GitHub repository, tagged release and installable release package.
- Live HTTPS site, deployed browser smoke tests and verified download links.
- Honest application brief, maintainer roadmap, no invented users or acceptance claims.

## Execution

- [x] Inspect source, official deployment references and available account access.
- [x] Confirm clean repository name and licensed font assets.
- [x] Implement standalone engine and schema.
- [x] Complete regression tests and output inspection.
- [x] Build examples, docs and launch site.
- [x] Verify fresh package installation and security/dependency checks.
- [ ] Publish repository and first release.
- [ ] Deploy and verify the public site and playground.
- [ ] Enable automated checks and deployment.
- [ ] Prepare application evidence and final handoff.

## Scope

The original private PDFAlarm SaaS stays separate. This release publishes the engine,
examples and site. It does not publish private credentials, customer data or the
unfinished SaaS authentication/billing implementation. No paid domain purchase is
needed: the launch uses the account's HTTPS workers.dev domain.

The program is selective. Publishing does not guarantee acceptance. Application
submission follows the user's review of the prepared brief and accurate account facts.
