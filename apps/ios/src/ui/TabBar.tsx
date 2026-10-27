import { Pressable, Text, View } from 'react-native';
import { useRouter, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuthGate } from '../features/auth/useAuthGate.ts';
import { Icon } from './Icon.tsx';
import { colors, sizes } from './tokens.ts';
import { createStyles } from './styles.ts';

type Glyph = 'search' | 'person' | 'chat';
const INACTIVE = '#818680';
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Demo NavGlyph: Radix outline when idle, a filled 24px glyph when the tab is current. */
export function TabGlyph({ kind, active }: { kind: Glyph; active: boolean }) {
  if (!active) return <Icon name={kind === 'search' ? 'MagnifyingGlass' : kind === 'chat' ? 'ChatBubble' : 'Person'} size={24} color={INACTIVE} />;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill={colors.forest}>
      {kind === 'chat' ? (
        <>
          <Path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <Path d="M7 9h10M7 13h7" stroke="white" strokeWidth={1.5} />
        </>
      ) : kind === 'person' ? (
        <>
          <Circle cx={12} cy={7} r={5} />
          <Path d="M3 23v-3a9 9 0 0 1 18 0v3Z" />
        </>
      ) : (
        <>
          <Circle cx={10} cy={10} r={8} />
          <Path d="m16 16 6 6" stroke={colors.forest} strokeWidth={4} />
          <Circle cx={10} cy={10} r={4} fill="white" />
        </>
      )}
    </Svg>
  );
}

const TABS: Record<string, { label: string; glyph: Glyph }> = {
  index: { label: 'Discover', glyph: 'search' },
  meals: { label: 'Meals', glyph: 'person' },
  inbox: { label: 'Inbox', glyph: 'chat' },
  profile: { label: 'Profile', glyph: 'person' },
};

/** Four destinations plus the raised central Create meal circle (demo .bottom-nav); labels always visible. */
export function FancyTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 0) + 6 }]} accessibilityRole="tablist" accessibilityLabel="Main navigation">
      {state.routes.map((route, index) => {
        if (route.name === 'create-tab') return <CreateTabButton key={route.key} />;
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => { if (!active) navigateToTab(route.key); }}
            style={styles.tab}
          >
            <TabGlyph kind={tab.glyph} active={active} />
            <Text style={[styles.label, active && styles.active]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Raised Create meal circle; guests are routed to sign-in with /create remembered (no auto-create). */
export function CreateTabButton() {
  const router = useRouter();
  const gate = useAuthGate();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Create meal" onPress={() => gate('/create') && router.push('/create')} style={[styles.tab, styles.create]}>
      <View style={styles.circle}>
        <Icon name="Plus" size={28} color={colors.white} />
      </View>
      <Text style={[styles.label, styles.active]}>Create meal</Text>
    </Pressable>
  );
}

const styles = createStyles({
  bar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7, paddingHorizontal: 9, minHeight: 83 },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 5 },
  create: { paddingTop: 32, position: 'relative' },
  circle: { position: 'absolute', top: -28, width: sizes.createCircle, height: sizes.createCircle, borderRadius: sizes.createCircle / 2, backgroundColor: colors.forest, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: colors.forest, shadowOpacity: 0.13, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  label: { fontSize: 10, color: INACTIVE },
  active: { color: colors.forest },
});
