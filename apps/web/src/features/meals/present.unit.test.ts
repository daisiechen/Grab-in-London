import { describe, expect, it } from 'vitest';
import { areaName } from './present.ts';

describe('areaName', () => {
  it('uses the verified London area dataset names, title-cases other codes and shows unknown as London', () => {
    expect(areaName('soho')).toBe('Soho');
    expect(areaName('st-jamess')).toBe('St James’s');
    expect(areaName('kings-cross-bloomsbury-north')).toBe('King’s Cross & Bloomsbury North');
    expect(areaName('fixture-area')).toBe('Fixture Area');
    expect(areaName('constructor')).toBe('Constructor');
    expect(areaName('unknown')).toBe('London');
  });
});
