import { Tabs } from 'expo-router';
import { CreateTabButton, TabGlyph } from '../../src/ui/TabBar.tsx';
import { colors } from '../../src/ui/tokens.ts';

/** Four destinations plus the raised central Create circle (DESIGN.md); labels always visible. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.forest, tabBarInactiveTintColor: colors.muted, headerTitleStyle: { color: colors.ink } }}>
      <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: ({ color }) => <TabGlyph glyph="⌕" color={color} /> }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarIcon: ({ color }) => <TabGlyph glyph="◷" color={color} /> }} />
      <Tabs.Screen name="create-tab" options={{ title: 'Create', tabBarButton: () => <CreateTabButton /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: ({ color }) => <TabGlyph glyph="✉" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabGlyph glyph="◯" color={color} /> }} />
    </Tabs>
  );
}
