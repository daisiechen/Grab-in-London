/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles static image assets only through require(). */
import type { ImageSourcePropType } from 'react-native';
import { apiBaseUrl } from '../config.ts';
import { localPhotos } from './local-photos.ts';

export { localPhotos };

/** Bundled artwork copied from demo/public/images (fictional, generated for this project). */
export const images = {
  restaurant: require('../../assets/images/restaurant.png') as ImageSourcePropType,
  londonMap: require('../../assets/images/london-map.png') as ImageSourcePropType,
  brandTable: require('../../assets/images/brand-table.png') as ImageSourcePropType,
};

const PEOPLE: Record<string, ImageSourcePropType> = {
  maya: require('../../assets/images/maya.png') as ImageSourcePropType,
  leo: require('../../assets/images/leo.png') as ImageSourcePropType,
  emma: require('../../assets/images/emma.png') as ImageSourcePropType,
};

const UPLOADED = /^https?:\/\/[^/?#]+(\/v1\/avatars\/[0-9a-f-]{36})$/i;

/**
 * Seed/preview profiles point at `preview://images/maya.png`-style URLs; those resolve to the bundled
 * demo portraits. Uploaded photos (`<origin>/v1/avatars/<id>`) are loaded from the API this app talks
 * to — the server's public origin can be another host in development, and a local dev API is plain
 * http. Preview uploads resolve through `localPhotos`. Any other https URL is loaded remotely; anything
 * else has no photo.
 */
export function avatarSource(url: string | null | undefined): ImageSourcePropType | null {
  if (!url) return null;
  const key = /\/([a-z]+)\.png$/.exec(url)?.[1];
  if (key && PEOPLE[key]) return PEOPLE[key];
  const local = localPhotos.get(url);
  if (local) return { uri: local };
  const uploaded = UPLOADED.exec(url)?.[1];
  if (uploaded) return { uri: apiBaseUrl().replace(/\/$/, '') + uploaded };
  return url.startsWith('https://') ? { uri: url } : null;
}
