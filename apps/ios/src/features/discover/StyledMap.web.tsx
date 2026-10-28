import type { ReactNode } from 'react';

/** react-native-maps has no web renderer; callers fall back to their illustrated map on web. */
export const nativeMapAvailable = () => false;
export type StyledMapHandle = never;
export function StyledMap(_props: { children?: ReactNode; [key: string]: unknown }) {
  return null;
}
export function MapMarker(_props: { children?: ReactNode; [key: string]: unknown }) {
  return null;
}
