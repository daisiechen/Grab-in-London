import { AssistantError } from './errors.ts';

export interface Preferences {
  areas: string[];
  budgetMaxPence: number | null;
  tableSizes: number[];
  dietaryCodes: string[];
  languages: string[];
  moods: string[];
}
export const emptyPreferences = (): Preferences => ({ areas: [], budgetMaxPence: null, tableSizes: [], dietaryCodes: [], languages: [], moods: [] });

/** Strict six-field allowlist; no prose, inferred cuisine, dates or silently discarded properties. */
export function validatePreferences(value: unknown, allowedAreas: readonly string[]): Preferences {
  const bad = () => { throw new AssistantError('AI_INVALID_PREFERENCES'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad();
  const obj = value as Record<string, unknown>;
  const expected = Object.keys(emptyPreferences()).sort();
  if (Object.keys(obj).sort().join(',') !== expected.join(',')) return bad();
  const array = <T extends string | number>(key: string, allowed: readonly T[]): T[] => {
    const values = obj[key];
    if (!Array.isArray(values) || values.length > allowed.length || new Set(values).size !== values.length || values.some((x) => !allowed.includes(x as T))) return bad();
    return [...values].sort() as T[];
  };
  const budget = obj.budgetMaxPence;
  if (budget !== null && (typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget < 1 || budget > 1_000_000)) return bad();
  return {
    areas: array('areas', allowedAreas), budgetMaxPence: budget as number | null,
    tableSizes: array('tableSizes', [2, 3, 4, 5, 6]),
    dietaryCodes: array('dietaryCodes', ['VEGETARIAN_OPTIONS', 'VEGAN']),
    languages: array('languages', ['en', 'zh', 'fr', 'es', 'hi']),
    moods: array('moods', ['EASY_CONVERSATION', 'FOOD_DISCOVERIES', 'TRAVEL_CULTURE']),
  };
}
