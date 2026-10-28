import {
  INTERESTS, LEGACY_LANGUAGE_LABELS, LIFE_STATUSES, LANGUAGES,
  type InterestCode, type LanguageCode, type LifeStatusCode,
} from '@fancy/contracts';
import type { RequestOf } from '@fancy/client';
import type { Me } from '../auth/session.ts';

export type MePatch = RequestOf<'updateMe'>['body'];

/** Prototype option order (demo ProfilePreferences); labels map to contract codes explicitly. */
export const LANGUAGE_CHOICE_LABELS = ['English', 'Mandarin', 'French', 'Spanish', 'Hindi', 'English & Mandarin', 'English & French'] as const;
export type LanguageChoice = (typeof LANGUAGE_CHOICE_LABELS)[number];

export const languageChoiceCodes = (label: LanguageChoice): readonly LanguageCode[] => LEGACY_LANGUAGE_LABELS[label] ?? [];

export function languageChoiceFor(codes: readonly LanguageCode[]): LanguageChoice | null {
  const key = [...codes].sort().join(',');
  return LANGUAGE_CHOICE_LABELS.find((label) => [...languageChoiceCodes(label)].sort().join(',') === key) ?? null;
}

export const lifeStatusOptions = (Object.entries(LIFE_STATUSES) as Array<[LifeStatusCode, string]>);
export const interestOptions = (Object.entries(INTERESTS) as Array<[InterestCode, string]>);
export const languageOptions = (Object.entries(LANGUAGES) as Array<[LanguageCode, string]>).map(([code, label]) => [code, code === 'zh' ? 'Mandarin' : label] as const);

/** PRD r07: a sample portrait is chosen from three; no real photos are collected. */
export const AVATAR_CHOICES = ['leo', 'maya', 'emma'] as const;
export const avatarRefFor = (key: (typeof AVATAR_CHOICES)[number]) => `avatar:${key}`;

export interface ProfileForm {
  avatarRef: string | null;
  displayName: string;
  bio: string;
  lifeStatus: LifeStatusCode | null;
  languages: LanguageCode[];
  interests: InterestCode[];
  work: string;
  school: string;
  hometown: string;
}

export type ProfileField = 'displayName' | 'bio' | 'lifeStatus' | 'languages' | 'interests' | 'consent' | 'background';

export function formFromMe(me: Me): ProfileForm {
  return {
    avatarRef: me.avatarRef,
    displayName: me.displayName ?? '',
    bio: me.bio ?? '',
    lifeStatus: me.lifeStatus,
    languages: [...me.languages],
    interests: [...me.interests],
    work: me.background.work ?? '',
    school: me.background.school ?? '',
    hometown: me.background.hometown ?? '',
  };
}

/** Same boundaries as the API (name 2–40, bio 20–1000 trimmed; QA-INPUT-001..008) checked in field order. */
export function validateProfile(form: ProfileForm, opts: { requireConsent: boolean; consent: boolean }): { field: ProfileField; message: string } | null {
  const name = form.displayName.trim();
  const bio = form.bio.trim();
  if (name.length < 2 || name.length > 40) return { field: 'displayName', message: 'Add a name of 2–40 characters.' };
  if (bio.length < 20 || bio.length > 1000) return { field: 'bio', message: 'Write an introduction of 20–1,000 characters.' };
  if (!form.lifeStatus) return { field: 'lifeStatus', message: 'Choose your life in London.' };
  if (form.languages.length < 1) return { field: 'languages', message: 'Choose a conversation language.' };
  if (form.interests.length < 1) return { field: 'interests', message: 'Choose at least one interest.' };
  for (const key of ['work', 'school', 'hometown'] as const) {
    if (form[key].trim().length > 150) return { field: 'background', message: 'Keep work, school and hometown to 150 characters each.' };
  }
  if (opts.requireConsent && !opts.consent) return { field: 'consent', message: 'Confirm the age and community acknowledgement to continue.' };
  return null;
}

/** Allow-listed PATCH /me body; trimmed text, empty background fields omitted, policy versions only when newly acknowledged. */
export function buildPatch(form: ProfileForm, opts: { policyVersion: string | null }): MePatch {
  const background: { work?: string; school?: string; hometown?: string } = {};
  for (const key of ['work', 'school', 'hometown'] as const) {
    const v = form[key].trim();
    if (v) background[key] = v;
  }
  const patch: MePatch = {
    ...(form.avatarRef ? { avatarRef: form.avatarRef } : {}),
    displayName: form.displayName.trim(),
    bio: form.bio.trim(),
    languages: [...form.languages],
    interests: [...form.interests],
    background,
    ...(form.lifeStatus ? { lifeStatus: form.lifeStatus } : {}),
    ...(opts.policyVersion ? { ageConfirmedVersion: opts.policyVersion, communityAcceptedVersion: opts.policyVersion } : {}),
  };
  return patch;
}

/** Map server fieldErrors (422) onto form fields; unknown keys fall back to a general message. */
export function serverFieldMessage(fieldErrors: Record<string, string> | undefined): { field: ProfileField | null; message: string } {
  const entries = Object.entries(fieldErrors ?? {});
  const known: Record<string, ProfileField> = { displayName: 'displayName', bio: 'bio', lifeStatus: 'lifeStatus', languages: 'languages', interests: 'interests', background: 'background' };
  for (const [key, message] of entries) {
    const field = known[key.replace(/^\/?(body\/)?/, '').split(/[./]/)[0] ?? ''];
    if (field) return { field, message };
  }
  return { field: null, message: 'Check your profile details and try again.' };
}

export const needsConsent = (me: Me) => !me.profileGate.ageConfirmed || !me.profileGate.communityAccepted;
