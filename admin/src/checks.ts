import type { summarize, cohorts } from "./analytics";
export type DataCheck = {
  id: "empty" | "evidence" | "discovery" | "observing" | "repeat";
  numerator: number;
  denominator: number;
  target: "quality" | "supply" | "retention";
};
// Inspectable rules, not agent-written advice or a ranking of product priorities.
export function dataChecks(
  summary: ReturnType<typeof summarize>,
  rows: ReturnType<typeof cohorts>,
): DataCheck[] {
  if (!summary.meals.length && !summary.noResults.denominator && !rows.length)
    return [{ id: "empty", numerator: 0, denominator: 0, target: "quality" }];
  const checks: DataCheck[] = [];
  if (summary.attendanceCoverage.denominator)
    checks.push({
      id: "evidence",
      numerator: summary.attendance.unknown + summary.attendance.conflict,
      denominator: summary.attendanceCoverage.denominator,
      target: "supply",
    });
  if (summary.noResults.denominator)
    checks.push({ id: "discovery", ...summary.noResults, target: "supply" });
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  if (total)
    checks.push(
      summary.retention.denominator
        ? { id: "repeat", ...summary.retention, target: "retention" }
        : {
            id: "observing",
            numerator: total,
            denominator: total,
            target: "retention",
          },
    );
  return checks;
}
