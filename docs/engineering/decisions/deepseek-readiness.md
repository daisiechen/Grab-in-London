# DeepSeek readiness preparation (not activation)

Checked 2026-10-21 against the primary sources below. This additive record supports QA-AI-050/052
and G-AI-MODEL/DATA/COST; it changes none of the approved ten design documents or release thresholds.
No credential was read, no provider request sent, no model/price bundle approved or enabled.

## Verified interface and implemented local boundary

The official [Chat Completions reference](https://api-docs.deepseek.com/api/create-chat-completion/)
documents `/chat/completions`, `json_object`, `max_tokens`, prompt/completion usage and terminal
finish reasons. The local adapter posts to the fixed official HTTPS origin, refuses redirects,
disables streaming and tools, caps output at 2,000 tokens, and performs no automatic transport retry.
Non-stop finishes (including content filtering), refusal/tool responses, missing/invalid usage,
empty/partial/nonobject JSON, invalid IDs and output overflow yield no usable draft. Valid returned
usage is retained for settlement; uncertain dispatched cost remains UNKNOWN. An already-aborted
request is rejected before network. These are isolated local transport tests, not live compatibility.

[JSON Output guidance](https://api-docs.deepseek.com/guides/json_mode/) requires a JSON instruction
and warns that content can be empty. JSON mode does not replace server schema, fact, authorization
or editor validation. The adapter sends the schema in a JSON instruction; the application still
validates returned plans and candidates before any transfer.

[Thinking-mode guidance](https://api-docs.deepseek.com/guides/thinking_mode/) states that thinking is
enabled by default. This adapter explicitly sends `thinking:{type:'disabled'}` and budgets/settles
all reported completion tokens, never a visible-text-only estimate. No OpenAI `store:false`, tools,
web search, user identifier or Responses API option is inherited. A stateless API description is
not proof that provider security/billing logs or other retention are zero.

## Candidate pricing evidence; G-AI-COST remains blocked

The current [official Chinese pricing page](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)
lists `deepseek-flash`, version `DeepSeek-V4.1-Flash-1017`, and `deepseek-v4-pro`, version
`DeepSeek-V4-Pro-0813`. For Flash, **peak uncached input is CNY2/million tokens and peak output is
CNY8/million tokens**. Cache hits and off-peak discounts must not reduce the admission reserve.
For a single call bounded to 16,000 input and 2,000 output tokens, this candidate price yields an
upper bound of 48,000 microCNY (CNY0.048). This is a checked candidate, not a configured price row.

The [CNY budget decision](ai-cny-budget.md) continues to cap internal monthly admission at
50,000,000 microCNY. No USD conversion or default recharge is added. Official names can resolve to
new versions; documentation of today's alias is not an immutable account snapshot. Before enabling:
approve the actual available model/version and effective price version, validate the whole-message
conservative tokenizer bound (system/schema/history/protocol overhead included), approve missing
money/call quotas, and verify provider billing/reconciliation. The application's ledger cannot
constrain unrelated calls made with the same provider account. The official
[token-usage guide](https://api-docs.deepseek.com/quick_start/token_usage/) labels offline estimates
as estimates and treats returned API usage as the billing reference; character ratios do not prove
our pre-dispatch upper bound.

## Data boundary; G-AI-DATA remains blocked

The [DeepSeek privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)
was dated 2026-02-10 when checked. It describes input collection, improvement/training purposes,
variable retention and processing/storage in China, and distinguishes downstream developer
responsibilities. This general text is **not an account-specific API DPA or zero-retention guarantee**.
A Tencent Seoul application host does not establish Seoul provider processing or retention.

The remaining evidence must come from applicable API/account terms and, where necessary, written
provider confirmation: actual processing locations/subprocessors, prompt/output and abuse-log
retention/deletion, training use and enforceable opt-out, applicable transfer safeguards and user
notice/approval. This task sends no email and accepts no terms. `store:false` is absent from this
adapter's allowlisted request and cannot close G-AI-DATA even if a compatible endpoint ignores it.

## Evaluation preparation; G-AI-MODEL remains blocked

`packages/testkit/src/ai-evals` provides a fixed 60-case synthetic bilingual corpus in the approved
20/10/10/10/10 distribution, a network-free default runner, explicit offline harness runner and
captured-result validator. Artifacts include the original input/context/expectation, actual
observation, deviations, versions, evidence references and timing. Lifecycle, authorization and
cost scenarios must run through an instrumented application harness; they are not certified by
asking a model to report success. Synthetic labels must map to isolated test fixture UUIDs.

Dry runs return NOT_RUN/BLOCKED, never a model score. Local validator tests use synthetic answers
only. Real acceptance still requires approved credentials/configuration and an isolated real-model
harness executing all sixty cases, independent draft reviews, inspection of referenced evidence,
zero violations of hard constraints/account isolation/business-write/identity-state boundaries,
≥90% intent/field and draft usability, five concurrent scenarios, P95 ≤10 seconds and all terminal
outcomes ≤30 seconds. A locally passing adapter or validator test closes none of those real gates.

| Case / gate | Can execute without a Key now | Remaining dependency |
| --- | --- | --- |
| QA-AI-050 | Fixed corpus, interface/failure tests, dry-run and artifact validation | Approved model/prompt/schema/configuration plus real 60-case quality/latency evidence and human review |
| QA-AI-052 | Request allowlist, JSON/usage/refusal/timeout tests, no-store inheritance assertion | Actual account/API data terms, retention/region evidence and explicit approval; then isolated live compatibility probe |
| G-AI-COST | Integer peak-price reserve example and existing ledger fault tests | Approved effective model/price/quotas, conservative tokenizer and billing/reconciliation evidence |

These are prerequisite bundles rather than one missing API Key. Supplying a Key alone never
satisfies model, data, cost or release approval.
