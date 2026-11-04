import { createContext, useCallback, useContext, useMemo, useRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

/** What the scroll view currently shows, in content coordinates (contentOffset space). */
export interface RevealViewport {
  /** contentOffset.y; negative at rest when iOS insets content below a translucent header. */
  scrollY: number;
  /** Frame height of the scroll view. A pinned footer is a sibling, so it is already excluded. */
  height: number;
  /** Part of the frame covered at the top (translucent header) and bottom (keyboard). */
  insetTop: number;
  insetBottom: number;
}

export const REVEAL_MARGIN = 12;

/**
 * Scroll offset that brings a just-expanded block (content y/height) fully into view above the
 * pinned footer, or null when it is already visible. A block taller than the visible area, or one
 * above it, is aligned to the top so its beginning is never hidden.
 */
export function revealOffset(target: { y: number; height: number }, v: RevealViewport, margin = REVEAL_MARGIN): number | null {
  const visibleTop = v.scrollY + v.insetTop;
  const visibleBottom = v.scrollY + v.height - v.insetBottom;
  const top = target.y - margin;
  const bottom = target.y + target.height + margin;
  if (top >= visibleTop && bottom <= visibleBottom) return null;
  if (top < visibleTop || bottom - top > visibleBottom - visibleTop) return top - v.insetTop;
  return bottom - v.height + v.insetBottom;
}

type RevealNode = ComponentRef<typeof View>;
type RevealFn = (node: RevealNode) => void;
const RevealContext = createContext<RevealFn | null>(null);

/**
 * Wires a ScrollView so `<Reveal>` blocks inside it scroll themselves into view when they expand.
 * Spread `scrollProps` on the ScrollView and wrap its children in `<RevealScope value={reveal}>`.
 */
export function useRevealScroll() {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef<RevealViewport>({ scrollY: 0, height: 0, insetTop: 0, insetBottom: 0 });
  // Fabric reports UIScrollView.contentInset, not the automatic (header) adjustment, so the resting
  // offset (−header height, seen in the first scroll event) is the more reliable top inset.
  const restingTop = useRef<number | null>(null);

  const reveal = useCallback<RevealFn>((node) => {
    const scroller = ref.current;
    const content = scroller?.getInnerViewRef();
    if (!scroller || !content) return;
    node.measureLayout(content, (_x, y, _w, height) => {
      const next = revealOffset({ y, height }, viewport.current);
      if (next !== null) scroller.scrollTo({ y: next, animated: true });
    }, () => undefined);
  }, []);

  const scrollProps = useMemo(() => ({
    ref,
    scrollEventThrottle: 16,
    onLayout: (e: LayoutChangeEvent) => { viewport.current = { ...viewport.current, height: e.nativeEvent.layout.height }; },
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentInset, layoutMeasurement } = e.nativeEvent;
      restingTop.current ??= Math.max(0, -contentOffset.y);
      viewport.current = {
        scrollY: contentOffset.y,
        height: layoutMeasurement?.height || viewport.current.height,
        insetTop: Math.max(contentInset?.top ?? 0, restingTop.current),
        insetBottom: contentInset?.bottom ?? 0,
      };
    },
  }), []);

  return { scrollProps, reveal };
}

export const RevealScope = RevealContext.Provider;

/** A block that scrolls itself fully into view when it first appears or changes height. */
export function Reveal({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string | undefined }) {
  const reveal = useContext(RevealContext);
  const ref = useRef<RevealNode>(null);
  const lastHeight = useRef<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height === lastHeight.current) return;
    lastHeight.current = height;
    if (ref.current) reveal?.(ref.current);
  };
  return <View ref={ref} style={style} onLayout={onLayout} testID={testID}>{children}</View>;
}
