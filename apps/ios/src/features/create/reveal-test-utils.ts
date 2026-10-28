import { ScrollView, View } from 'react-native';

/** A `layout` event payload for fireEvent. */
export const layout = (height: number, width = 390) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });

/**
 * Test-only geometry for `<Reveal>`: every measured block sits at `target` in the scroll content.
 * Returns the ScrollView.scrollTo spy. Restore with jest.restoreAllMocks().
 */
export function mockContentGeometry(target: { y: number; height: number }) {
  const scroll = ScrollView.prototype as unknown as { scrollTo: () => void; getInnerViewRef: () => unknown };
  const view = View.prototype as unknown as { measureLayout: (rel: unknown, ok: (x: number, y: number, w: number, h: number) => void) => void };
  jest.spyOn(scroll, 'getInnerViewRef').mockReturnValue({});
  jest.spyOn(view, 'measureLayout').mockImplementation((_rel, ok) => ok(0, target.y, 358, target.height));
  return { scrollTo: jest.spyOn(scroll, 'scrollTo').mockImplementation(() => undefined) };
}
