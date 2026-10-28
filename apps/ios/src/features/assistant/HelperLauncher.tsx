import { useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import * as Router from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '../../ui/tokens.ts';
import { createStyles } from '../../ui/styles.ts';

/** Fancy helper mascot (demo HelperSprite). */
export function HelperSprite({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
      <Path d="M32 12C25 2 16 6 18 15c-13 4-16 18-11 29 4 10 11 13 25 11 14 2 21-1 25-11 5-11 2-25-11-29 2-9-7-13-14-3Z" fill={colors.forest} />
      <Path d="M30 13c0-8 7-11 13-9-1 6-6 10-13 9Z" fill="#d7ee79" />
      <Ellipse cx={23} cy={33} rx={3} ry={4} fill="#f5f2e8" />
      <Ellipse cx={41} cy={33} rx={3} ry={4} fill="#f5f2e8" />
      <Path d="M26 43q6 5 12 0" fill="none" stroke="#f5f2e8" strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={16} cy={40} r={3} fill={colors.peach} />
      <Circle cx={48} cy={40} r={3} fill={colors.peach} />
    </Svg>
  );
}

// Isolated tests mock expo-router without these hooks; the launcher then uses the safe bottom dock.
const usePathname: () => string | null = typeof Router.usePathname === 'function' ? Router.usePathname : () => null;
const useSegments: () => string[] = typeof Router.useSegments === 'function' ? Router.useSegments as () => string[] : () => [];
const TAB_PATHS = new Set(['/', '/meals', '/inbox', '/profile']);

const WIDTH = 64;
const HEIGHT = 74;

/**
 * Demo helper launcher: a white card docked to a screen edge, draggable, tappable to open and
 * tuckable to a smaller sprite. Docks below the discovery header and above the tab bar.
 */
export function HelperLauncher({ onOpen }: { onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const segments = useSegments();
  // Discover (the tabs index) docks on the map below the filters, as in the demo. Everywhere else,
  // and whenever the route is unknown, it docks bottom-right so it never covers headers or controls.
  const onDiscover = pathname === '/' || (segments.length === 1 && segments[0] === '(tabs)') || segments[segments.length - 1] === 'index';
  const onTabs = onDiscover || (pathname !== null && TAB_PATHS.has(pathname)) || segments[0] === '(tabs)';
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [tucked, setTucked] = useState(false);
  const [offsetY, setOffsetY] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dockTop = insets.top + (onDiscover ? 215 : 64);
  const dockBottom = height - insets.bottom - (onTabs ? 83 : 0) - HEIGHT - 24;
  const home = onDiscover ? dockTop : dockBottom;
  const y = Math.min(Math.max(offsetY ?? home, dockTop), Math.max(dockTop, dockBottom));
  const x = side === 'right' ? width - WIDTH - (tucked ? -20 : 14) : tucked ? -20 : 14;
  const start = useRef({ x: 0, y: 0 });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 6,
      onPanResponderGrant: () => { start.current = { x: xRef.current, y: yRef.current }; },
      onPanResponderMove: (_, g) => setDrag({ x: start.current.x + g.dx, y: start.current.y + g.dy }),
      onPanResponderRelease: (_, g) => {
        const endX = start.current.x + g.dx;
        setSide(endX + WIDTH / 2 < widthRef.current / 2 ? 'left' : 'right');
        setOffsetY(start.current.y + g.dy);
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;
  const xRef = useRef(x);
  const yRef = useRef(y);
  const widthRef = useRef(width);
  xRef.current = x;
  yRef.current = y;
  widthRef.current = width;
  const at = drag ?? { x, y };
  return (
    <View style={[styles.launcher, { left: at.x, top: at.y }]} {...pan.panHandlers}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tucked ? 'Show Fancy helper' : 'Ask Fancy'}
        accessibilityHint="Drag to move. Tap to open."
        onPress={() => (tucked ? setTucked(false) : onOpen())}
        style={[styles.card, tucked && styles.cardTucked]}
      >
        <HelperSprite />
        {tucked ? null : <Text style={styles.label}>Ask Fancy</Text>}
      </Pressable>
      {tucked ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Hide Fancy helper" hitSlop={6} onPress={() => setTucked(true)} style={[styles.hide, side === 'left' ? styles.hideLeft : styles.hideRight]}>
          <Text style={styles.hideText}>{side === 'right' ? '›' : '‹'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = createStyles({
  launcher: { position: 'absolute', zIndex: 16, width: WIDTH, height: HEIGHT, borderRadius: 24, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  card: { alignItems: 'center', gap: 1, width: WIDTH, minHeight: HEIGHT, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 24, backgroundColor: colors.white },
  cardTucked: { minHeight: 64, padding: 8, borderWidth: 1, borderColor: colors.line },
  label: { fontSize: 10, fontWeight: '700', color: colors.forest },
  hide: { position: 'absolute', top: -8, minWidth: 28, minHeight: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  hideRight: { right: -8 },
  hideLeft: { left: -8 },
  hideText: { fontSize: 19, color: colors.ink, lineHeight: 22 },
});
