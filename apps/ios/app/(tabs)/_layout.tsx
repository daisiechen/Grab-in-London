import { Tabs } from 'expo-router';
import { FancyTabBar } from '../../src/ui/TabBar.tsx';

/** Four destinations plus the raised central Create circle (demo .bottom-nav); top-level pages draw their own headers. */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <FancyTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals' }} />
      <Tabs.Screen name="create-tab" options={{ title: 'Create meal' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
