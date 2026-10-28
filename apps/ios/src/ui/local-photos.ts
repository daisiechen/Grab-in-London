/**
 * Photos held only on this device (preview-mode uploads): short `preview://uploads/…` URL → data URI,
 * so DTOs stay within the contract's 500-character URL limit. Dependency-free so the preview fake
 * API can use it under plain Node (e2e parity) as well as in the app.
 */
export const localPhotos = new Map<string, string>();
