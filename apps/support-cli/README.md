# Fancy support CLI (T18)

Production workspace client for case-scoped support. Requires Node 24 and the workspace install. By default each invocation opens the system browser, signs in, receives an opaque access token in process RAM and executes exactly one JSON-stdin command. It does not print or write credentials, use refresh tokens, create grants, access the database or automatically retry writes.

The browser flow is implemented; real provider configuration, MFA enrollment and the support role/case-specific grant remain **external operational gates**. Obtain them through the approved identity/support process. The server verifies role, MFA, current session and case grant on every support request; installing this program does not confer access. A CLI access token lasts 15 minutes with no refresh. Each normal invocation authenticates again. Do not reuse a browser CSRF token or a personal API key as the access token.

Set `FANCY_API_URL` to the approved HTTPS API origin (no path/query/userinfo). Leave `FANCY_SUPPORT_TOKEN` unset to use browser sign-in. Explicitly provisioned existing opaque tokens in that environment variable remain supported for controlled test/operational fixtures; they are never refreshed or saved. Do not put tokens or private JSON in argv, shell history, committed files or terminal transcripts. Loopback API HTTP is accepted solely for local acceptance fixtures. API fetch redirects fail closed. This program neither provisions credentials nor accepts service terms.

The CLI binds only `127.0.0.1` at an OS-selected port and registers the exact `http://127.0.0.1:<port>/auth/callback` URI with `startOAuth` (`client=SUPPORT_CLI`, S256 `appChallenge`). The identity provider returns to the configured web origin's **core HTTP** `/v1/auth/oauth/callback`; that URL must be registered with the real provider. The core redirects the browser to the registered loopback using only a 60-second single-use handoff `code` and `state` equal to `stateTransactionId`. The CLI verifies the raw fixed path, exact Host, method and state, then exchanges with its RAM-only PKCE verifier. Access tokens never enter browser URLs. Unregistered hosts, normalized/encoded alternate paths, duplicate parameters and cross-origin requests are rejected. The listener expires after 10 minutes, closes after acceptance/error, and the handoff exchange is bounded to 60 seconds. OS launch uses `/usr/bin/open`, `/usr/bin/xdg-open` or the Windows system URL handler with argument arrays and no shell. A browser-launch or login failure produces a fixed diagnostic; there is no printed secret/link fallback.

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

Successful writes output only `{ok,command,version}`; they suppress mutation responses containing private case facts. Errors use fixed diagnostics, never server exception text, tokens, submitted reason/body, field errors or request IDs. Exit codes: `0` success, `1` request/login failure, `2` invalid command/input/environment. Authentication tests use actual temporary loopback HTTP listeners plus mocked identity transport and browser launch; they do not log into real accounts or prove live MFA/provider configuration.

Validation: `pnpm --filter @fancy/support-cli typecheck` and `pnpm --filter @fancy/support-cli test`.
