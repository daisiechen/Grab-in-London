/** Developer acceptance tools are opt-in and never part of the product presentation. */
export function isReviewMode(search: string): boolean {
  return new URLSearchParams(search).get("review") === "1";
}
