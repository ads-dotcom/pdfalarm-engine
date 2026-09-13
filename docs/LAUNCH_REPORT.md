# Launch report

PDFAlarm Engine v0.1.0 launched on 2026-09-13. The standalone engine, examples,
source code, developer documentation and browser playground are public.

## Public deliverables

- [Live HTTPS site and playground](https://pdfalarm-engine.hakan-olcer.workers.dev/)
- [Public MIT repository](https://github.com/ads-dotcom/pdfalarm-engine)
- [v0.1.0 release and installation package](https://github.com/ads-dotcom/pdfalarm-engine/releases/tag/v0.1.0)
- [Developer documentation](https://pdfalarm-engine.hakan-olcer.workers.dev/docs.html)
- [Completed work plan](../WORK_PLAN.md)
- [Application form text](APPLICATION_FORM_TEXT.md)

The release includes the installable package, four fictional sample PDFs and
SHA256SUMS. The released package was downloaded through its public URL and
installed successfully; the README quickstart generated a real PDF. The downloaded
package SHA-256 matches the uploaded file:
`570742504881deeace30226e5c6c4df34fa75c0610de69e6943162366fa3fd19`.

The package is distributed through GitHub Releases. It is not currently published
on the npm registry; the installation command uses its complete release URL.

## Verification evidence

[Release-source CI run](https://github.com/ads-dotcom/pdfalarm-engine/actions/runs/34780788750)
passed all four jobs: engine on Linux Node.js 22, engine on Linux Node.js 24,
desktop/mobile browser checks, and automated Cloudflare deployment plus live route
verification. The verified release-source commit is
`f6f399f4205f97e91bc9c6666eaae45b9e09c5b1`.

- 29 engine regressions passed, including independent QR/barcode decoding from
  actual generated PDF pixels, font extraction, flowing tables, assets and overlays.
- The engine generated a PDF inside a real local Cloudflare workerd runtime.
- Twelve browser checks passed on the deployed HTTPS site, covering previews,
  real downloads, errors, stale-download prevention during example switches,
  table page navigation, public routes and automated accessibility checks.
- Live route checks passed for 14 routes and a genuine 404 response.
- Four example PDFs and desktop/mobile screenshots were visually inspected.
- npm audit reported zero known advisories for runtime and development dependencies.
- Source signature and supplied GitHub/Cloudflare credential scans found no matches.

See [validation scope and limitations](VALIDATION.md). Passing these checks is not
an exhaustive security, browser, accessibility or document-compliance certification.

## Maintenance setup

CI validates pull requests. Main-branch pushes deploy only after engine and browser
jobs succeed. Deployment credentials are encrypted GitHub repository secrets.
GitHub secret scanning, push protection, vulnerability alerts and private
vulnerability reporting are enabled. Main-branch protection requires the three
validation jobs and prevents force pushes/deletion; repository administrators can
still perform maintainer tasks. A contribution guide, security policy, changelog,
third-party licenses and maintenance roadmap are included.

## Application handoff

The OpenAI application has not been submitted. The project description and the
500-character answers are prepared in [APPLICATION_FORM_TEXT.md](APPLICATION_FORM_TEXT.md).
Confirm the applicant's name, ChatGPT account email, maintainer identity and current
form attestations when applying through the [official form](https://openai.com/form/codex-for-oss/).

This is a new public engine extracted and hardened from the original private app.
External adoption is not established. OpenAI acceptance remains a separate decision;
no users, stars, downloads or earlier public maintenance history have been invented.
