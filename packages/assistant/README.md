# Assistant implementation and remaining gates

The AI contracts, HTTP routes and read-only orchestration are implemented and tested against controlled
provider responses. **The default API remains model-disabled.** No real credentials, verified price,
full-message tokenizer, approved fixed model, retention agreement or 60-sample evaluation is supplied.
Mock results do not establish real-provider quality or release readiness.

## Modules

`src/` contains strict six-field preference validation, a single-process RAM session owner (device,
subject, generation, preference epoch, exact 30-minute expiry, activity dedup, capacity bounds, abort,
recent assistant turns, condition tombstones, results/artifacts and guest confirmed soft preferences),
and the typed DeepSeek adapter. The adapter uses bounded nonthinking JSON output and no network retry;
mock adapters refuse staging/production. No text is serialized into PostgreSQL or a normal idempotency
response body. A process restart destroys assistant text, drafts and guest preferences.

`apps/api/src/assistant/` contains:

- `PreferenceService`: confirmed account CAS replacement/deletion, tombstones and synchronous RAM /
  session/request invalidation, independent of model enablement. Six approved preference fields only.
- `SessionService`: metadata/device proof, server-authoritative RAM TTL, explicit activity, fixed 24h
  hashed guest credentials. Guest creation has durable clientRequestId dedup and keyed-IP admission;
  duplicate bootstrap challenge is refused after restart rather than minting another old-intent token.
- `RequestService`: HMAC-only metadata, permanent requestId/payload dedup, one subject in flight,
  London-day successful-turn reservations (user50/guest10, max5/min), 30s terminal deadline and no work
  replay. Final publication checks active core identity, preference epoch, RAM and source authorization.
- `BudgetLedger` / `runBudgetedCall`: approved daily/monthly CNY reserve before each of at most two
  internal calls, one-winner dispatch, known-usage settlement/cancellation exactly once, UNKNOWN
  liability retained across restart. MFA `ai_budget_ops` reconciliation needs provider evidence, CAS
  and an idempotency key. Unexpected actual overrun is recorded and disables further admission.
- `query`: exact input-source provenance, server-resolved London dates/GBP/dictionary values, hard
  condition precedence and CLEAR tombstones. Saved values are soft scores, never automatic filters.
  Unknown/ambiguous dates or Spanish, unsupported cheapness and omitted explicit constraints clarify.
- `context` / `controller`: full eligible public candidate set → hard filters → stable soft ranking →
  top20 context/top3 cards. Comparison/explanation uses server public facts; an own application
  explanation reads only that user's latest state/version, never its message. No chat/review/reconnect/
  survey/report/admin content is a model input. Facts/permissions are revalidated before publication.
- `drafts`: second-call application20–300 / create-title5–80 + description20–1000 / group1–1000 text
  candidates; schema, identity/completion claim, link and markup rejection. Group generation and
  transfer need active group membership. Transfer checks source version, editor version/replacement
  confirmation and a SUCCEEDED request. Repeated transfer returns the same replacement, never appends
  or calls an application/create/send/booking/payment command. Unknown dates/venue/attestations are
  never synthesized. Preference proposals remain RAM-only until a separate user-confirmed CAS save.
- `routes`: standard core envelope, Origin/CSRF, device binding, explicit intents, no-store and safe
  machine errors. A valid guest bearer/cookie remains a guest subject; sessionId alone is no credential.
- `lifecycle`: sole API startup UNKNOWN/failed recovery, 1s RAM/deadline sweep and shutdown invalidation.

`prelockUserAI(txClient,userId)` only locks metadata and does not erase RAM or mutate rows. Call it
before the final privacy lock/clock/authentication check. Then `invalidateUserAI(txClient,runtime,
userId,reason)` runs inside the core user UPDATE barrier: abort and erase RAM, supersede pending
requests, refund success slots, cancel undispatched calls and preserve dispatched UNKNOWN cost.
`revokeGuestAI` supports login conversion without migrating guest context/preferences.

## API/client details

Registered operations live in `packages/contracts/src/operations/assistant.ts`, with closed DTOs in
`assistant-dto.ts`. API integration lives in the coordinator-owned core server. `readAI` returns only
the current device's RAM turns and latest request ID; read/poll do not renew TTL. Every AI write uses
its own resource/intent metadata rather than the normal persistent response-body idempotency store.

`requestAI.guestPreferences` is an optional **complete** six-field object. Only a guest may supply it;
the server validates it and stores confirmed values in that current assistant session's RAM. Omitting
it reuses that RAM value. Account requests reject it instead of overriding DB-confirmed preferences.
These are soft scores, separate from `appliedFilters`. NEW destroys guest session values; clients must
clear guest values for NEW. When the approved UX preserves confirmed values after an idle restart,
the client can explicitly resend its own still-confirmed RAM values into the new session. Login never
migrates them to account preferences. Refresh/reinstall must not use persistent preference/body caches.

## Verification boundary

Controlled local tests cover concurrent last-budget and last-success-slot admission, duplicate calls,
settlement/cancellation/reconciliation, restart UNKNOWN liability, preference CAS/deletion, read-only
prelocking, guest fixed expiry/dedup/CSRF/device proof, hard/soft/CLEAR provenance, three drafts,
comparison/explanation, cross-target/editor revocation, malicious provider outputs and zero changes to
business tables while generating/transferring. These are functional tests, not the A08 real evaluation.

Before real activation: configure verified full wire-input/schema token counting, current peak prices
and bounded billable outputs, explicit daily money/call limits and monthly ≤CNY50, a real approved
provider/model/data policy, operational reconciliation HTTP/CLI with server-derived role/MFA,
provider deadline/usage spike and ≥60 real evaluation samples. Native/Web assistant UI and real
cross-end testing remain separate. Geographic bounds need a provider-backed location projection;
no unavailable map constraint is silently relaxed. Broader natural-language date/area aliases require
validated cases; unsupported expressions clarify instead of inventing facts or conditions.
