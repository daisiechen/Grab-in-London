# Fancy support CLI (T18)

Production workspace client for case-scoped support. Requires Node 24 and the workspace install. It uses `@fancy/client` with an opaque bearer access token held only in environment/process RAM. No token file, refresh token, login bypass, grant creation, database access or automatic write retry is provided.

Real CLI login, MFA enrollment/verification, access-token issuance and a case-specific grant remain **external operational gates**. Obtain them through the approved identity/support process. The server verifies staff role, MFA age, current session and case grant on every request; possessing this program does not confer access. Expired access requires a new approved login. Do not reuse a browser CSRF token or a personal API key as the access token.

Set `FANCY_API_URL` to the approved HTTPS API origin (no path/query/userinfo), and inject `FANCY_SUPPORT_TOKEN` through a secure launcher or a non-echoing secret prompt. Do not put tokens or private JSON in argv, shell history, committed files or terminal transcripts. Loopback HTTP is accepted solely for local acceptance fixtures. HTTP redirects fail closed. This program neither provisions credentials nor accepts service terms.

Exactly one command is required. All input comes from JSON stdin, bounded to 16 KiB. Unknown/missing fields are rejected. Examples below show shapes only: use an approved secure stdin source with real values, rather than pasting private facts into a shell command.

```text
pnpm --filter @fancy/support-cli start view < /approved/private/input.json
pnpm --filter @fancy/support-cli start resolve < /approved/private/input.json
pnpm --filter @fancy/support-cli start correct-attendance < /approved/private/input.json
```

`view` is the only command that outputs private case facts. Be deliberate about its terminal audience and output destination. Input:

```json
{"caseId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
```

`resolve` updates the case status (`OPEN`, `IN_REVIEW` or `RESOLVED`). `expectedVersion` is the case version from an authorized view, sent as `If-Match`. `publicOutcome` may be null; any text is intentionally reporter-visible under server rules. `reason` is an audited support justification. Input:

```json
{"caseId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","expectedVersion":"1","intentKey":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","status":"RESOLVED","publicOutcome":"The report has been reviewed.","reason":"Reviewed the relevant evidence."}
```

`correct-attendance` requires the target meal and subject, value `present` or `absent`, an audited reason and the attendance effective revision as `expectedVersion` (not the case version). Server case authorization, correction window, eligibility and concurrency rules remain authoritative. Input:

```json
{"caseId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","expectedVersion":"0","intentKey":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","mealId":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","subjectId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","value":"present","reason":"Reviewed the relevant attendance evidence."}
```

Generate one UUID `intentKey` for a reviewed write intent and retain the exact JSON until its outcome is known. The CLI sends one HTTP request per invocation. Following an uncertain transport failure, an operator may explicitly retry identical JSON with the same key. Do not change the key to work around an unknown outcome. After a version/state conflict, review current authorized facts and create a new intent only for a changed, deliberate action. The program does not infer a version or grant, does not generate replacement keys, and does not silently retry or refresh.

Successful writes output only `{ok,command,version}`; they suppress mutation responses containing private case facts. Errors use fixed diagnostics, never server exception text, tokens, submitted reason/body, field errors or request IDs. Exit codes: `0` success, `1` request failure, `2` invalid command/input/environment. Transport tests use synthetic fixtures, not live MFA or provider acceptance.

Validation: `pnpm --filter @fancy/support-cli typecheck` and `pnpm --filter @fancy/support-cli test`.
