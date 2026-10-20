export const londonDate = (at: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
export function relativeMealDay(startsAt: string, now: string) {
  const difference = Math.round(
    (Date.parse(londonDate(startsAt) + "T00:00:00Z") -
      Date.parse(londonDate(now) + "T00:00:00Z")) /
      86400000,
  );
  return difference === 0
    ? "Today"
    : difference === 1
      ? "Tomorrow"
      : difference > 1
        ? `In ${difference} days`
        : difference === -1
          ? "Yesterday"
          : `${-difference} days ago`;
}
