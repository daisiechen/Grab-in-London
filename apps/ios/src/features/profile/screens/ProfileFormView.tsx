import { Image, Pressable, Text, View } from 'react-native';
import type { InterestCode, LanguageCode } from '@fancy/contracts';
import { ChoiceGroup, MultiChoice } from '../../../ui/ChoiceGroup.tsx';
import { Field } from '../../../ui/Field.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { avatarSource, presetAvatarUrl } from '../../../ui/images.ts';
import { createStyles } from '../../../ui/styles.ts';
import { colors } from '../../../ui/tokens.ts';
import {
  AVATAR_CHOICES, avatarRefFor, LANGUAGE_CHOICE_LABELS, interestOptions, languageChoiceCodes, languageChoiceFor, languageOptions, lifeStatusOptions,
  type ProfileField, type ProfileForm,
} from '../model.ts';

const toggle = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Shared by profile setup (single language choice, as in the prototype) and edit (multiple). */
export function ProfileFormView({ form, onChange, error, mode }: { form: ProfileForm; onChange: (next: ProfileForm) => void; error: { field: ProfileField | null; message: string } | null; mode: 'setup' | 'edit' }) {
  const set = (patch: Partial<ProfileForm>) => onChange({ ...form, ...patch });
  const fieldError = (f: ProfileField) => (error?.field === f ? error.message : null);
  return (
    <View style={{ gap: 14 }}>
      <AvatarChoice value={form.avatarRef} onChange={(avatarRef) => set({ avatarRef })} />
      <Field label="First name" value={form.displayName} onChangeText={(displayName) => set({ displayName })} maxLength={40} placeholder="Alex" textContentType="givenName" autoComplete="given-name" error={fieldError('displayName')} />
      <Field
        label="A little about you"
        value={form.bio}
        onChangeText={(bio) => set({ bio })}
        maxLength={1000}
        multiline
        placeholder="What brought you to London? What do you enjoy?"
        hint="At least 20 characters. Share what you’re comfortable making public."
        error={fieldError('bio')}
      />
      <ChoiceGroup label="Your life in London" options={lifeStatusOptions} value={form.lifeStatus} onChange={(lifeStatus) => set({ lifeStatus })} />
      {mode === 'setup' ? (
        <ChoiceGroup
          label="Conversation language"
          options={LANGUAGE_CHOICE_LABELS.map((l) => [l, l] as const)}
          value={languageChoiceFor(form.languages)}
          onChange={(label) => set({ languages: [...languageChoiceCodes(label)] })}
        />
      ) : (
        <MultiChoice<LanguageCode> label="Conversation languages · choose one or more" options={languageOptions} values={form.languages} onToggle={(code) => set({ languages: toggle(form.languages, code) })} />
      )}
      <MultiChoice<InterestCode> label="Interests · choose one or more" options={interestOptions} values={form.interests} onToggle={(code) => set({ interests: toggle(form.interests, code) })} />
      {mode === 'edit' ? (
        <>
          <Field label="Work" value={form.work} onChangeText={(work) => set({ work })} maxLength={150} error={fieldError('background')} />
          <Field label="School" value={form.school} onChangeText={(school) => set({ school })} maxLength={150} />
          <Field label="Hometown" value={form.hometown} onChangeText={(hometown) => set({ hometown })} maxLength={150} />
        </>
      ) : null}
    </View>
  );
}

/** Demo “Choose a photo”: three sample portraits, the chosen one ringed and ticked. */
function AvatarChoice({ value, onChange }: { value: string | null; onChange: (ref: string) => void }) {
  return (
    <View style={styles.avatarWrap} accessibilityRole="radiogroup" accessibilityLabel="Choose a photo">
      <Text style={styles.avatarLabel}>Choose a photo</Text>
      <View style={styles.avatarRow}>
        {AVATAR_CHOICES.map((key) => {
          const ref = avatarRefFor(key);
          const on = value === ref;
          const source = avatarSource(presetAvatarUrl(ref));
          return (
            <Pressable key={key} accessibilityRole="radio" accessibilityLabel={`Choose ${key} portrait`} accessibilityState={{ selected: on }} onPress={() => onChange(ref)} style={[styles.avatar, on && styles.avatarOn]}>
              {source ? <Image source={source} style={styles.avatarImage} accessibilityIgnoresInvertColors /> : null}
              {on ? <View style={styles.tick}><Icon name="Check" size={12} color={colors.white} /></View> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.avatarHint}>Sample portraits only; we don’t collect real photos.</Text>
    </View>
  );
}

const styles = createStyles({
  avatarWrap: { gap: 8 },
  avatarLabel: { fontSize: 12, fontWeight: '500', color: colors.muted },
  avatarRow: { flexDirection: 'row', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  avatarOn: { borderColor: colors.forest },
  avatarImage: { width: '100%', height: '100%', borderRadius: 28 },
  tick: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.forest, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  avatarHint: { fontSize: 11, color: colors.muted },
});
