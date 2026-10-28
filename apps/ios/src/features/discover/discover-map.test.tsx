import { render, screen, fireEvent } from '@testing-library/react-native';
import { UIManager } from 'react-native';
import { DiscoverMap, nativeMapAvailable } from './DiscoverMap.tsx';
import { areaPlace, groupByArea } from './areas.ts';
import { meal } from '../../test/fixtures.ts';

const soho = (id: string, lat: number) => meal({ id, areaCode: 'soho', venue: { ...meal().venue, areaCode: 'soho', location: { lat, lng: -0.13 } } });

describe('discovery map', () => {
  afterEach(() => { delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY; jest.restoreAllMocks(); });

  it('groups geo pins per area at the average restaurant position', () => {
    const { groups, unplaced } = groupByArea([soho('a', 51.51), soho('b', 51.52), meal()], 'geo');
    expect(groups.map((g) => [g.code, g.meals.length])).toEqual([['soho', 2], ['shoreditch', 1]]);
    expect(groups[0]?.lat).toBeCloseTo(51.515);
    expect(unplaced).toHaveLength(0);
    expect(groupByArea([meal()], 'illustrated').unplaced).toHaveLength(1);
  });

  it('names a meal’s place without repeating London for an unmapped area', () => {
    expect(areaPlace('soho')).toBe('Soho, London');
    // The real API answers `unknown` for a restaurant outside its verified area dataset's launch zone.
    expect(areaPlace('unknown')).toBe('London');
    // Names from the API's verified London area dataset keep their punctuation.
    expect(areaPlace('holborn-bloomsbury-south')).toBe('Holborn & Bloomsbury South, London');
    expect(areaPlace('kings-cross-bloomsbury-north')).toBe('King’s Cross & Bloomsbury North, London');
    expect(areaPlace('st-jamess')).toBe('St James’s, London');
    expect(areaPlace('constructor')).toBe('Constructor, London');
  });

  it('falls back to the demo illustration without a key', async () => {
    expect(nativeMapAvailable()).toBe(false);
    const onSelect = jest.fn();
    const { groups } = groupByArea([soho('a', 51.51)]);
    await render(<DiscoverMap groups={groups} activeCode="soho" onSelect={onSelect} />);
    expect(screen.queryByTestId('native-map')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Soho: 1 meal' }));
    expect(onSelect).toHaveBeenCalledWith('soho');
  });

  it('uses the Google native map with area pins when the key and module exist', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY = 'test-key';
    jest.spyOn(UIManager, 'getViewManagerConfig').mockReturnValue({} as never);
    const onSelect = jest.fn();
    const { groups } = groupByArea([soho('a', 51.51)], 'geo');
    await render(<DiscoverMap groups={groups} activeCode={null} onSelect={onSelect} />);
    expect(screen.getByTestId('native-map')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('map-pin-soho'));
    expect(onSelect).toHaveBeenCalledWith('soho');
  });
});
