/**
 * LINK_REQUIRED (API §7): a verified email matches an existing account. No business session is
 * issued; the ticket stays in memory (10 minutes, single use) and is never put in a URL.
 * CONTRACT GAP: how the client obtains `originalChallengeProof` for POST /auth/links is not specified,
 * so the dual-proof submit is not implemented yet; the screen explains how to continue.
 */
let pendingLink: { linkTicket: string; expiresAt: string | null } | null = null;

export const setPendingLink = (value: typeof pendingLink) => {
  pendingLink = value;
};
export const getPendingLink = () => pendingLink;
export const clearPendingLink = () => {
  pendingLink = null;
};
