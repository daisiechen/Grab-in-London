import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { ApiError, type ResponseOf } from '@fancy/client';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, SectionTitle } from '../../../ui/Text.tsx';
import { useServices } from '../../../services.tsx';
import { ProfileView } from './ProfileView.tsx';

type Data = ResponseOf<'getPublicProfile'>['data'];

/** Guest-visible public projection and published references. */
export function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { api } = useServices();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    api
      .call('getPublicProfile', { params: { userId: String(userId) } })
      .then((res) => live && setData(res.data))
      .catch((e: unknown) => live && setError(e instanceof ApiError && e.kind === 'not_found' ? 'This profile isn’t available.' : 'We couldn’t load this profile. Check your connection and try again.'));
    return () => {
      live = false;
    };
  }, [api, userId, attempt]);

  if (error) {
    return (
      <Screen>
        <FormMessage message={error} />
        <Primary secondary label="Try again" onPress={() => setAttempt((n) => n + 1)} />
      </Screen>
    );
  }
  if (!data) return <Screen><ActivityIndicator accessibilityLabel="Loading profile" /></Screen>;
  const p = data.profile;
  return (
    <Screen testID="public-profile">
      <ProfileView displayName={p.displayName} bio={p.bio} languages={p.languages} interests={p.interests} background={p.background} />
      <SectionTitle>References</SectionTitle>
      {data.reviews.length === 0 ? <Body muted>No public references yet.</Body> : data.reviews.map((r) => <Body key={r.id}>{`“${r.body}” — ${r.author.displayName}`}</Body>)}
      <TextAction label="Report this profile" onPress={() => router.push(`/report?targetType=USER&targetId=${p.id}`)} />
    </Screen>
  );
}
