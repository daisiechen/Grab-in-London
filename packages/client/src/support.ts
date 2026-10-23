/**
 * PATCH-001 public support exit (PRD0.6 §13, AC-001a/b). The link only opens the person's own
 * mail editor: it never carries a receiptToken, credential or private data, and opening it is
 * not evidence that anything was sent or received.
 */
export const SUPPORT_EMAIL = 'xcheniepaut26@gmail.com';
export const supportMailto = (): string => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Fancy account removal support')}`;
