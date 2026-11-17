# Direct method submissions — activation checklist

This branch replaces the Issue redirect with a domain selector and a Hugging Face model-link field. It sends a JSON POST to the team's receiver. Visitors do not sign into GitHub or create issues. There are ten top-level domains and no subdomains.

The receiver source is in `Statsinference/stats-inference-arena/method-submissions/service/`. It writes only `method-submissions/received/<domain>/README.md` in that research repository, using server-side credentials. The existing Issue archive and scientific workflows remain unchanged.

## Current status

Implemented and locally tested, **not deployed or enabled**. No endpoint or credentials were available in the current tool connections. Do not merge this branch into the production website until the receiver has been deployed and an end-to-end submission has been verified. No production submission is claimed by the local mocked tests.

## Activate

1. Deploy the receiver as documented in the research repository's `method-submissions/DIRECT_SUBMISSIONS.md`.
2. Set this branch's `assets/submission-config.json` to `enabled: true`, `mode: "direct"`, and the actual HTTPS receiver endpoint ending in `/api/submit`. Never put the repository token in this file.
3. Bump the `submit-method.js` and `submit-method.css` cache query versions in `index.html`.
4. Test a real POST without any visitor GitHub credentials, check that the selected domain file contains the link, and check failure responses preserve the input and do not claim success.
5. Merge only the submission-related files. Do not alter result data, leaderboard code or domain taxonomy.

Local checks: ten domain options, no subdomain, selected domain actually sent, no issue URL or popup, success only after a receipt, duplicate handling, invalid URLs, failed requests, missing configuration, unchanged leaderboard results and sorting, and 320/390/768/1440px layouts. The backend has separate storage, concurrency and validation tests.
