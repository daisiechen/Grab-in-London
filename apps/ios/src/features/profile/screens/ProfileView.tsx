import { Text, View } from 'react-native';
import { INTERESTS, LANGUAGES, LIFE_STATUSES, type InterestCode, type LanguageCode, type LifeStatusCode } from '@fancy/contracts';
import { colors } from '../../../ui/tokens.ts';
import { createStyles } from '../../../ui/styles.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { Pill, Tag } from '../../../ui/Bits.tsx';

const languageLabel = (c: LanguageCode) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c]);

/** Public projection (demo member page): portrait, name, background, introduction, interests, languages. */
export function ProfileView({ displayName, avatarUrl = null, bio, lifeStatus, languages, interests, background }: {
  displayName: string | null; avatarUrl?: string | null; bio: string | null; lifeStatus?: LifeStatusCode | null; languages: readonly LanguageCode[]; interests: readonly InterestCode[];
  background?: { work?: string; school?: string; hometown?: string } | undefined;
}) {
  const facts = [background?.work, background?.school, background?.hometown].filter(Boolean).join(' · ');
  const name = displayName ?? 'New member';
  return (
    <View>
      <View style={styles.heading}>
        <View accessibilityLabel={`${name} portrait`}><Avatar person={{ displayName: name, avatarUrl }} size={88} /></View>
        <Text accessibilityRole="header" style={styles.h1}>{name}</Text>
        {facts ? <Text style={styles.facts}>{facts}</Text> : null}
        {lifeStatus ? <Pill>{LIFE_STATUSES[lifeStatus]}</Pill> : null}
      </View>
      <Text accessibilityRole="header" style={styles.h2}>A little about me</Text>
      <Text style={styles.prose}>{bio ?? 'Not provided'}</Text>
      <Text accessibilityRole="header" style={styles.h2}>We could talk about</Text>
      {interests.length ? <View style={styles.tags}>{interests.map((i) => <Tag key={i}>{INTERESTS[i]}</Tag>)}</View> : <Text style={styles.prose}>Not provided</Text>}
      <Text accessibilityRole="header" style={styles.h2}>Languages</Text>
      <View style={styles.languages}>
        <Icon name="Globe" size={18} />
        <Text style={styles.body}>{languages.length ? languages.map(languageLabel).join(' · ') : 'Not provided'}</Text>
      </View>
    </View>
  );
}

const styles = createStyles({
  heading: { alignItems: 'center', marginTop: 7, marginBottom: 25 },
  h1: { fontSize: 29, lineHeight: 32, letterSpacing: -1.05, fontWeight: '700', color: colors.ink, marginTop: 13, marginBottom: 7, textAlign: 'center' },
  facts: { fontSize: 12, color: colors.muted, marginBottom: 11, textAlign: 'center' },
  h2: { fontSize: 17, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 27, marginBottom: 13 },
  prose: { color: '#65716a', fontSize: 14, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  languages: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { fontSize: 14, color: colors.ink },
});
