/**
 * Public avatar URLs. PRD r07: members pick one of three sample portraits (no real photos are
 * collected), stored as `avatar:<key>`. The portraits are static assets on the web origin
 * (apps/web/public/avatars); iOS bundles the same art and resolves the URL by its file name.
 */
export const SAMPLE_AVATARS = ['leo', 'maya', 'emma'] as const;
let origin: string | null = null;
/** Set once at startup from the validated WEB_ORIGIN. */
export function configureAvatarOrigin(webOrigin: string) { origin = webOrigin.replace(/\/$/, ''); }
export function avatarUrl(ref: string | null | undefined): string | null {
  const key = ref?.startsWith('avatar:') ? ref.slice('avatar:'.length) : null;
  if (!origin || !key || !(SAMPLE_AVATARS as readonly string[]).includes(key)) return null;
  return `${origin}/avatars/${key}.png`;
}
