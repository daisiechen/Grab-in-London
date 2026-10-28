import { useRef, useState } from 'react';
import { PanResponder, Pressable, View, useWindowDimensions } from 'react-native';
import * as Router from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../ui/tokens.ts';
import { createStyles } from '../../ui/styles.ts';

/**
 * Fancy helper mark: a white speech bubble with a citrus spark on the forest disc. Replaces the
 * earlier cartoon sprite; reads as an assistant entry at 20–48pt.
 */
export function HelperSprite({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
      <Circle cx={24} cy={24} r={24} fill={colors.forest} />
      <Path d="M14 15.5h20a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H24l-6 4.5v-4.5h-4a3.5 3.5 0 0 1-3.5-3.5V19a3.5 3.5 0 0 1 3.5-3.5Z" fill="#f5f2e8" />
      <Path d="M24 18.5c.6 2.9 1.6 3.9 4.5 4.5-2.9.6-3.9 1.6-4.5 4.5-.6-2.9-1.6-3.9-4.5-4.5 2.9-.6 3.9-1.6 4.5-4.5Z" fill="#c9e05f" />
    </Svg>
  );
}

// Isolated tests mock expo-router without these hooks; the launcher then uses the safe bottom dock.
const usePathname: () => string | null = typeof Router.usePathname === 'function' ? Router.usePathname : () => null;
const useSegments: () => string[] = typeof Router.useSegments === 'function' ? Router.useSegments as () => string[] : () => [];
const TAB_PATHS = new Set(['/', '/meals', '/inbox', '/profile']);

const SIZE = 44;
const EDGE = 10;

/**
 * Compact helper entry: a 44pt disc docked to a screen edge, draggable to either side, that opens
 * Ask Fancy on tap. Docks just under the Discover filters, and above the tab bar or bottom bar
 * elsewhere, so it never covers headers, controls or the primary action.
 */
export function HelperLauncher({ onOpen }: { onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const segments = useSegments();
  const onDiscover = pathname === '/' || (segments.length === 1 && segments[0] === '(tabs)') || segments[segments.length - 1] === 'index';
  const onTabs = onDiscover || (pathname !== null && TAB_PATHS.has(pathname)) || segments[0] === '(tabs)';
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [offsetY, setOffsetY] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dockTop = insets.top + (onDiscover ? 150 : 64);
  // Above the tab bar on tab pages; above a bottom action bar (~70pt) on stack pages.
  const dockBottom = height - insets.bottom - (onTabs ? 83 : 76) - SIZE - 12;
  const home = onDiscover ? dockTop : dockBottom;
  const y = Math.min(Math.max(offsetY ?? home, dockTop), Math.max(dockTop, dockBottom));
  const x = side === 'right' ? width - SIZE - EDGE : EDGE;
  const live = useRef({ x, y, width });
  live.current = { x, y, width };
  const start = useRef({ x: 0, y: 0 });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 6,
      onPanResponderGrant: () => { start.current = { x: live.current.x, y: live.current.y }; },
      onPanResponderMove: (_, g) => setDrag({ x: start.current.x + g.dx, y: start.current.y + g.dy }),
      onPanResponderRelease: (_, g) => {
        setSide(start.current.x + g.dx + SIZE / 2 < live.current.width / 2 ? 'left' : 'right');
        setOffsetY(start.current.y + g.dy);
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;
  const at = drag ?? { x, y };
  return (
    <View style={[styles.launcher, { left: at.x, top: at.y }]} {...pan.panHandlers}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ask Fancy" accessibilityHint="Opens the Fancy helper. Drag to move." onPress={onOpen} hitSlop={6} style={styles.disc}>
        <HelperSprite size={SIZE - 4} />
      </Pressable>
    </View>
  );
}

const styles = createStyles({
  launcher: { position: 'absolute', zIndex: 16, width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
