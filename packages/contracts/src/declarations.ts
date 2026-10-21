import type { CuisineCode, DietaryCode } from './dictionaries.ts';

export interface HostDeclarations {
  cuisineCode: CuisineCode | null;
  dietaryCodes: DietaryCode[] | null;
}

/**
 * P-05 / data contract §6: omitted and null both mean "not provided" and normalise to null.
 * Dietary codes are de-duplicated in dictionary order; an empty array is never stored, because it
 * would read as a guarantee that no restriction applies.
 */
export function normalizeHostDeclarations(input: { cuisineCode?: CuisineCode | null | undefined; dietaryCodes?: readonly DietaryCode[] | null | undefined }): HostDeclarations {
  const order: DietaryCode[] = ['VEGETARIAN_OPTIONS', 'VEGAN'];
  const dietary = input.dietaryCodes ? order.filter((code) => input.dietaryCodes!.includes(code)) : [];
  return { cuisineCode: input.cuisineCode ?? null, dietaryCodes: dietary.length ? dietary : null };
}
