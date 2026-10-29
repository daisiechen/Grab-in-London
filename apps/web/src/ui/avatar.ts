const UPLOADED = /^(?:https?:\/\/[^/?#]+)?(\/v1\/avatars\/[0-9a-f-]{36})$/i;

/**
 * Uploaded photos (`<origin>/v1/avatars/<id>`) load from this site's own `/v1` (the API is served
 * same-origin; its public origin can differ in development). Any other https URL loads as is;
 * seed/preview URLs and anything else show the initial instead (iOS images.ts avatarSource).
 */
export function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const uploaded = UPLOADED.exec(url)?.[1];
  if (uploaded) return uploaded;
  return url.startsWith('https://') ? url : null;
}
