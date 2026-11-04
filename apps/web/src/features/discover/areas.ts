import type { Meal } from '../../api/types.ts';
import { areaName } from '../meals/present.ts';

/**
 * Pin positions on the illustrated central-London map (public/images/london-map.jpg), in percent of
 * the artwork. The web artwork is the prototype's crop (docs/design/web/prototype/assets), so the
 * positions are the prototype's, not the iOS PNG's. Areas without a position are listed, not pinned.
 */
const POSITIONS: Record<string, { x: number; y: number }> = {
  soho: { x: 44, y: 47 },
  fitzrovia: { x: 61, y: 31 },
  'covent-garden': { x: 80, y: 55 },
  'st-jamess': { x: 37, y: 67 },
  'st-james': { x: 37, y: 67 },
  'st-james-s': { x: 37, y: 67 },
};

export interface AreaGroup { code: string; name: string; meals: Meal[]; x: number; y: number }

/** Groups results by area in result order; the pin number is the meal count. */
export function groupByArea(meals: readonly Meal[]): { groups: AreaGroup[]; unplaced: Meal[] } {
  const groups = new Map<string, AreaGroup>();
  const unplaced: Meal[] = [];
  for (const meal of meals) {
    const at = POSITIONS[meal.areaCode];
    if (!at) { unplaced.push(meal); continue; }
    const group = groups.get(meal.areaCode) ?? { code: meal.areaCode, name: areaName(meal.areaCode), meals: [], x: at.x, y: at.y };
    group.meals.push(meal);
    groups.set(meal.areaCode, group);
  }
  return { groups: [...groups.values()], unplaced };
}
