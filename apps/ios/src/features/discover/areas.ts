import { areaLabel, type Meal } from '../meals/format.ts';

/**
 * Pin positions on the illustrated central-London map (assets/images/london-map.png), in percent
 * of the canvas, copied from demo/src/domain.ts. Areas without a position are listed, not pinned.
 */
const POSITIONS: Record<string, { x: number; y: number }> = {
  soho: { x: 48, y: 44 },
  fitzrovia: { x: 31, y: 24 },
  'covent-garden': { x: 79, y: 47 },
  'st-jamess': { x: 60, y: 79 },
  'st-james': { x: 60, y: 79 },
  'st-james-s': { x: 60, y: 79 },
};

const LABELS: Record<string, string> = { 'st-jamess': 'St James’s', 'st-james': 'St James’s', 'st-james-s': 'St James’s' };

export const areaName = (code: string) => LABELS[code] ?? areaLabel(code);

export interface AreaGroup { code: string; name: string; meals: Meal[]; x: number; y: number; lat: number | null; lng: number | null }

/**
 * Groups discovery results by area in result order; the pin number is the meal count.
 * `illustrated` pins only areas with a position on the drawn map; `geo` (native Google map) pins
 * every area that has at least one restaurant coordinate, at the average of those coordinates.
 */
export function groupByArea(meals: readonly Meal[], mode: 'illustrated' | 'geo' = 'illustrated'): { groups: AreaGroup[]; unplaced: Meal[] } {
  const groups = new Map<string, AreaGroup & { points: number }>();
  const unplaced: Meal[] = [];
  for (const meal of meals) {
    const at = POSITIONS[meal.areaCode];
    const loc = meal.venue.location;
    if (mode === 'illustrated' ? !at : !loc) {
      unplaced.push(meal);
      continue;
    }
    const group = groups.get(meal.areaCode) ?? { code: meal.areaCode, name: areaName(meal.areaCode), meals: [], x: at?.x ?? 0, y: at?.y ?? 0, lat: null, lng: null, points: 0 };
    group.meals.push(meal);
    if (loc) {
      group.lat = ((group.lat ?? 0) * group.points + loc.lat) / (group.points + 1);
      group.lng = ((group.lng ?? 0) * group.points + loc.lng) / (group.points + 1);
      group.points += 1;
    }
    groups.set(meal.areaCode, group);
  }
  return { groups: [...groups.values()].map(({ points: _points, ...g }) => g), unplaced };
}
