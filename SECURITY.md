# Security policy

The current supported release is 0.1.x. Report vulnerabilities privately using
GitHub's **Report a vulnerability** facility on this repository's Security tab.
Do not publish secrets or real customer documents in an issue.

This engine is a document generation library, not a sandbox or PDF sanitizer.
Only overlay trusted PDFs. Asset resolvers are application code: restrict their
sources, enforce bounded reads and honor AbortSignal cancellation. Default limits
reduce common mistakes; they do not replace isolation for hostile workloads.

The public playground renders locally in the browser and has no hosted rendering
endpoint, accounts or customer database. Website access still reaches Cloudflare.

We will triage reports as maintainer capacity permits. No guaranteed response-time
SLA is offered. Security patches will be documented in the changelog and releases.
