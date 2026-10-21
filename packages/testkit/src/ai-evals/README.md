# Fixed synthetic AI evaluation preparation

`corpus.ts` freezes 60 synthetic cases (30 English / 30 Chinese): find/multiturn/compare 20,
explanation 10, three editor drafts 10, preferences/lifecycle 10, permissions/injection/failure 10.
Each carries input, frozen public context, expected normalized observations, criteria and AC IDs.
No production dialogue, credential, personal profile or private message is included.

From the repository root after `source infra/dev-env.sh`:

```sh
node packages/testkit/src/ai-evals/cli.ts --dry-run > /private/tmp/fancy-ai-dry-run.json
node packages/testkit/src/ai-evals/cli.ts --validate-results /private/tmp/fancy-ai-dry-run.json
pnpm exec vitest run --project unit packages/assistant packages/testkit/src/ai-evals
```

The first command does not inspect an API key, construct a provider or send requests. All 60 are
`NOT_RUN`. The second command deliberately exits **2 / BLOCKED** for dry-run output. There is no
live CLI switch. Unknown options, including `--live`, exit 2 without network access.

`runOffline(evaluate, {versions})` supports an explicitly injected isolated local harness, bounded
to five concurrent scenarios. It returns `offline-controlled`, which never closes real quality
gates. `runner.unit.test.ts` contains generated *synthetic observations* solely to test the validator;
those are not model answers or evaluation results. Do not publish them as a passing model run.

A future separately approved integration harness must provision the synthetic fixtures in an
isolated database (translate `synthetic-*` labels to fixture UUIDs before API calls, then normalize
back), drive the real controller/UI/lifecycle, and record `actual.intent/fields`, actual draft text,
safety checks from DB/RAM/API evidence, independent reviewer usability, and timing intervals. The
model must never self-certify safety booleans. Expectation fields describe harness observations,
not an extra model output schema; e.g. `bookingClaim:false` must be checked against the generated
candidate and business state. Each scenario is isolated; F09 uses its own frozen DST clock.

Captured artifacts must use `real-provider-capture`, exact corpus contents/version, frozen
model/prompt/schema/price versions, approved model/data/cost evidence references, all sixty outcomes,
instrumented evidence references and human draft reviews. `validateResults` recomputes thresholds:
all four safety checks zero tolerance; intent/field correctness ≥90%; usable drafts ≥90%; observed
five-way concurrency, P95 ≤10 seconds, all terminal outcomes ≤30 seconds. Missing provenance,
reviews or execution is BLOCKED. A capture validator cannot authenticate the claims in an artifact;
independent QA must inspect its referenced evidence and approvals. Failed/missing real execution is
never replaced by the offline score. Synthetic artifact contents may be retained; real user prompts
must never be used as this corpus.
