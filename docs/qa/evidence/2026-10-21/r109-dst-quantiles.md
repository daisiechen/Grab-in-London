# R109 independent DST and quantile reconciliation

Baseline7e372cd, QA-only small independent fixed-asOf datasets; actual calculateMetrics, no page values used as oracle. Four PASS.

- Both UTC00:30/01:30 on25Oct2026 display London01:30 and belong to Sunday25Oct. Weekly unique counts2 on week19Oct and1 on Monday26Oct; Sunday-only date filter retains both repeated times.
-14day maturity uses elapsedUTC exact millisecond through fallback.30day repeat allows exactUTC30days and rejects+1hour rather than accepting same wall-hour calendar endpoint.
- Frozen plan1/2/3/10 and alternate1/2/4/10 hours give nearest-rankP50=2/P90=10. Later duplicate confirmation cannot change original decision; withdrawn/expired/cancelled do not add decision duration; only live pending before deadline counts, cancelled/exactdeadline do not.

R108 three initial green observations used alternate quantile vector; R109 expanded to exact frozen-plan vector as well, no threshold changed. METRIC015/017 PASS via planned independent_fixture_reconciliation. No browser/API export/native claim.
