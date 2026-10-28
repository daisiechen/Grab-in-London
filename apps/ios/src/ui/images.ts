/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles static image assets only through require(). */
import type { ImageSourcePropType } from 'react-native';

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

/**
 * Preview and seed profiles point at `…/maya.png`-style URLs; those resolve to the bundled demo
 * portraits. Any other https URL is loaded remotely; anything else has no photo.
 */
export function avatarSource(url: string | null | undefined): ImageSourcePropType | null {
  if (!url) return null;
  // Seed/preview profiles use `preview://images/maya.png`; demo portraits are bundled.
  const key = /\/([a-z]+)\.png$/.exec(url)?.[1];
  if (key && PEOPLE[key]) return PEOPLE[key];
  return url.startsWith('https://') ? { uri: url } : null;
}

/** Sample-portrait reference (`avatar:maya`) → a URL avatarSource resolves to the bundled portrait. */
export const presetAvatarUrl = (ref: string | null | undefined): string | null => {
  const key = ref?.startsWith('avatar:') ? ref.slice('avatar:'.length) : null;
  return key && PEOPLE[key] ? `preview://images/${key}.png` : null;
};
