# AI billing currency: CNY for the DeepSeek MVP

Decision date: 2026-10-21. Accepted by the implementation coordinator under the user's explicit
DeepSeek choice and RMB50/month budget. This supersedes only the older plan's microUSD accounting
unit and OpenAI-default provider assumption; it does not lower the AI quality/privacy gates.

All AI ledger amounts are integer **microCNY** (CNY1 = 1,000,000 microCNY). The global monthly hard
cap is at most **50,000,000 microCNY**. Currency is fixed to CNY by a database constraint; meal budgets
remain integer GBP pence. There is no implicit FX conversion. No key, account or billing information
is committed. Automatic recharge is not enabled.

Admission requires both explicitly approved daily and monthly money/call-count limits, enabled
budget rows, verified current price/model configuration, actual token-count bounds and a configured
provider credential. Missing approvals/configuration fail closed. Prices are not hardcoded from an
old note. Use the verified peak/cache-miss input price and full maximum output/reasoning allowance;
unknown pricing or an unbounded billable item must block the real adapter.

Every internal call separately reserves its maximum charge before dispatch. Calls use a unique id,
at most two per request, and a one-winner dispatch CAS; no SDK/transport automatic retries. Known
usage settles once and releases only the unused part. Unknown/timeout/restart calls retain their
full reservation, cannot be resent and require verified provider-statement reconciliation by the
server-authorized `ai_budget_ops` role plus MFA. Duplicate reconciliation is idempotent. Actual cost
above the assumed upper bound is recorded in full and disables further calls; the ledger never
hides a liability by clamping it to the reservation.

This application admission limit is **not** a guarantee about the provider account's absolute bill.
Real credentials, fixed-model availability, counting/pricing verification, provider data retention
approval, real quality/latency evaluation and operational MFA/CLI wiring remain release blockers.

Provider interface references checked during implementation:

- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/): fixed official
  endpoint, explicit output bound, nonstreaming and disabled thinking. An approved fixed model is
  still required; a mutable alias alone is not accepted as snapshot evidence.
- [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/): JSON object output is a shape
  aid, not proof of schema correctness or business facts. Server validation and evaluation remain.

The implementation provides a testable kernel, not yet an enabled HTTP AI feature. AI conversation
text/results remain in one API process RAM; PostgreSQL stores only whitelisted preference values
and accounting/request/session metadata. Restart invalidates RAM sessions and converts unfinished
call liability to UNKNOWN rather than replaying provider requests.
