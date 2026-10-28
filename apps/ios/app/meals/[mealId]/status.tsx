import { Stack } from 'expo-router';
import { ApplicationStatusScreen } from '../../../src/features/meals/ApplicationStatusScreen.tsx';

/** Title set here until app/_layout.tsx registers the route (owned by the main session). */
export default function ApplicationStatusRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Your application' }} />
      <ApplicationStatusScreen />
    </>
  );
}
