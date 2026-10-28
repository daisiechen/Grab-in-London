/** Platform-neutral map geometry shared by the Discover map and the Create restaurant picker. */

export interface MapRegion { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
export interface MapBounds { north: number; south: number; east: number; west: number }

export const CENTRAL_LONDON: MapRegion = { latitude: 51.5115, longitude: -0.1318, latitudeDelta: 0.03, longitudeDelta: 0.03 };

const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/** The visible region as search bounds (latitude clamped, longitude wrapped across the antimeridian). */
export function regionBounds(r: MapRegion): MapBounds {
  return {
    north: Math.min(90, r.latitude + r.latitudeDelta / 2),
    south: Math.max(-90, r.latitude - r.latitudeDelta / 2),
    east: wrap(r.longitude + r.longitudeDelta / 2),
    west: wrap(r.longitude - r.longitudeDelta / 2),
  };
}

/** Bounds rounded to ~10 m, so the same view reported twice doesn't trigger a second search. */
export const sameBounds = (a: MapBounds, b: MapBounds) =>
  (['north', 'south', 'east', 'west'] as const).every((k) => Math.abs(a[k] - b[k]) < 0.0001);

/**
 * The illustrated central-London artwork (assets/images/london-map.png, 1167×1347) is close to a
 * rotated geographic map. This affine fit of the four demo area pins (soho, fitzrovia, covent-garden,
 * st-james) places a coordinate on it in percent of the artwork, within ~3% of the drawn positions.
 */
export const ILLUSTRATED_ASPECT = 1347 / 1167;
const FIT = { lat: 51.51285, lng: -0.133025, x: 54.5, y: 48.5 };
export function illustratedPoint(lat: number, lng: number): { x: number; y: number } {
  const dLat = lat - FIT.lat;
  const dLng = lng - FIT.lng;
  return { x: FIT.x + 2380.97 * dLng - 2072.57 * dLat, y: FIT.y - 773.38 * dLng - 4350.41 * dLat };
}

/** Bounding box of everything drawn on the artwork, used when the map can't be panned. */
export const ILLUSTRATED_BOUNDS: MapBounds = { north: 51.5261, south: 51.4996, east: -0.108, west: -0.1618 };
