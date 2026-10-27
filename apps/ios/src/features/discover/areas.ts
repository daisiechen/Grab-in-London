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

export interface AreaGroup { code: string; name: string; meals: Meal[]; x: number; y: number }

/** Groups discovery results by area in result order; the pin number is the meal count. */
export function groupByArea(meals: readonly Meal[]): { groups: AreaGroup[]; unplaced: Meal[] } {
  const groups = new Map<string, AreaGroup>();
  const unplaced: Meal[] = [];
  for (const meal of meals) {
    const at = POSITIONS[meal.areaCode];
    if (!at) {
      unplaced.push(meal);
      continue;
    }
    const group = groups.get(meal.areaCode) ?? { code: meal.areaCode, name: areaName(meal.areaCode), meals: [], ...at };
    group.meals.push(meal);
    groups.set(meal.areaCode, group);
  }
  return { groups: [...groups.values()], unplaced };
}
