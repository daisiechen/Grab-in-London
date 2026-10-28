import { View } from 'react-native';
import type { InterestCode, LanguageCode } from '@fancy/contracts';
import { ChoiceGroup, MultiChoice } from '../../../ui/ChoiceGroup.tsx';
import { Field } from '../../../ui/Field.tsx';
import {
  LANGUAGE_CHOICE_LABELS, interestOptions, languageChoiceCodes, languageChoiceFor, languageOptions, lifeStatusOptions,
  type ProfileField, type ProfileForm,
} from '../model.ts';
import { ProfilePhotoField } from './ProfilePhotoField.tsx';

const toggle = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Shared by profile setup (single language choice, as in the prototype) and edit (multiple). */
export function ProfileFormView({ form, onChange, error, mode }: { form: ProfileForm; onChange: (next: ProfileForm) => void; error: { field: ProfileField | null; message: string } | null; mode: 'setup' | 'edit' }) {
  const set = (patch: Partial<ProfileForm>) => onChange({ ...form, ...patch });
  const fieldError = (f: ProfileField) => (error?.field === f ? error.message : null);
  return (
    <View style={{ gap: 14 }}>
      <ProfilePhotoField displayName={form.displayName} />
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
