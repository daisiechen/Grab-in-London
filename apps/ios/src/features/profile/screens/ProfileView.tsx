import { StyleSheet, Text, View } from 'react-native';
import { INTERESTS, LANGUAGES, LIFE_STATUSES, type InterestCode, type LanguageCode, type LifeStatusCode } from '@fancy/contracts';
import { colors, radius, type } from '../../../ui/tokens.ts';
import { Body, Heading, SectionTitle } from '../../../ui/Text.tsx';

const languageLabel = (c: LanguageCode) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c]);

/** Public projection only: name, introduction, languages, interests, optional background. */
export function ProfileView({ displayName, bio, lifeStatus, languages, interests, background }: {
  displayName: string | null; bio: string | null; lifeStatus?: LifeStatusCode | null; languages: readonly LanguageCode[]; interests: readonly InterestCode[];
  background?: { work?: string; school?: string; hometown?: string } | undefined;
}) {
  const facts = [background?.work && ['Work', background.work], background?.school && ['School', background.school], background?.hometown && ['Hometown', background.hometown]].filter(Boolean) as Array<[string, string]>;
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.avatar} accessibilityLabel={`${displayName ?? 'Member'} portrait`}>
        <Text style={styles.initial}>{(displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
      </View>
      <Heading>{displayName ?? 'New member'}</Heading>
      {lifeStatus ? <Body muted>{LIFE_STATUSES[lifeStatus]}</Body> : null}
      {bio ? <Body>{bio}</Body> : null}
      <SectionTitle>Languages</SectionTitle>
      <Body>{languages.length ? languages.map(languageLabel).join(' · ') : 'Not provided'}</Body>
      <SectionTitle>Interests</SectionTitle>
      <Body>{interests.length ? interests.map((i) => INTERESTS[i]).join(' · ') : 'Not provided'}</Body>
      {facts.map(([label, value]) => (
        <Body key={label}>{`${label}: ${value}`}</Body>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: radius.lg * 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: type.heading, color: colors.forest, fontWeight: '700' },
});
