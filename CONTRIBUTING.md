# Contributing

Thanks for helping make PDFAlarm Engine useful. The maintainer account is
[ads-dotcom](https://github.com/ads-dotcom). Start with a reproducible issue or a
small pull request. This first release has no established external user base.

1. Use Node.js 22+ and run `npm ci`.
2. Make the smallest change that solves the issue.
3. Add a regression test for a real behavior or failure mode.
4. Run `npm run check`. For playground changes, run `npm run test:browser`.
5. Document schema changes and breaking behavior in `CHANGELOG.md`.

Use fictional data and small fixtures. Never include real customer documents,
API keys or private account information. Avoid unrelated generated files.

By contributing, you agree that your contribution is distributed under the MIT
license. Do not introduce dependencies or font assets without compatible licenses
and attribution. Be respectful, explain disagreements and focus on the work.
