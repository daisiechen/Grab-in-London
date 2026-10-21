import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '@fancy/client';
import {
  INTERESTS, LANGUAGES, LIFE_STATUSES,
  type InterestCode, type LanguageCode, type LifeStatusCode,
} from '@fancy/contracts';
import { ArrowRightIcon, CheckIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage, fieldErrorsOf } from '../../api/errors.ts';
import type { Me, MePatch } from '../../api/types.ts';
import { safeReturnTo, signInPath } from '../../lib/returnTo.ts';
import { ChoiceGroup, Field, FormError, Loading, Primary, TextAction } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { AGE_CONFIRMATION_VERSION, COMMUNITY_PRINCIPLES_VERSION } from '../auth/consentVersions.ts';
import { CommunityPrinciples } from '../auth/CommunityPrinciples.tsx';

export interface ProfileForm {
  displayName: string;
  bio: string;
  lifeStatus: LifeStatusCode | null;
  languages: LanguageCode[];
  interests: InterestCode[];
  work: string;
  school: string;
  hometown: string;
  acknowledged: boolean;
}

const toForm = (me: Me): ProfileForm => ({
  displayName: me.displayName ?? '',
  bio: me.bio ?? '',
  lifeStatus: me.lifeStatus,
  languages: [...me.languages],
  interests: [...me.interests],
  work: me.background.work ?? '',
  school: me.background.school ?? '',
  hometown: me.background.hometown ?? '',
  acknowledged: false,
});

const needsAcknowledgement = (me: Me) => !me.profileGate.ageConfirmed || !me.profileGate.communityAccepted;

/** Client checks mirror API §6 lengths; the server re-validates and its fieldErrors win. */
export function validateProfile(form: ProfileForm, me: Me): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.displayName.trim();
  const bio = form.bio.trim();
  if (name.length < 2 || name.length > 40) errors.displayName = 'Use 2–40 characters.';
  if (bio.length < 20 || bio.length > 1000) errors.bio = 'Use 20–1,000 characters.';
  if (!form.lifeStatus) errors.lifeStatus = 'Choose your London life.';
  if (!form.languages.length) errors.languages = 'Choose at least one language.';
  if (!form.interests.length) errors.interests = 'Choose at least one interest.';
  for (const key of ['work', 'school', 'hometown'] as const) if (form[key].trim().length > 150) errors[key] = 'Use up to 150 characters.';
  if (needsAcknowledgement(me) && !form.acknowledged) errors.acknowledged = 'Confirm the age and community acknowledgement to continue.';
  return errors;
}

export function toPatch(form: ProfileForm, me: Me): MePatch {
  const background: NonNullable<MePatch['background']> = {};
  for (const key of ['work', 'school', 'hometown'] as const) {
    const value = form[key].trim();
    if (value) background[key] = value;
  }
  return {
    displayName: form.displayName.trim(),
    bio: form.bio.trim(),
    ...(form.lifeStatus ? { lifeStatus: form.lifeStatus } : {}),
    languages: form.languages,
    interests: form.interests,
    background,
    ...(needsAcknowledgement(me) && form.acknowledged
      ? { ageConfirmedVersion: AGE_CONFIRMATION_VERSION, communityAcceptedVersion: COMMUNITY_PRINCIPLES_VERSION }
      : {}),
  };
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * Profile edit and the profile gate (18+/community/required fields). With `returnTo`, saving
 * goes back to the interrupted page, whose draft is restored but never auto-submitted.
 */
export function ProfileEditPage() {
  const { api } = useApi();
  const { state, refresh } = useSession();
  const navigate = useNavigate();
  const notify = useToast();
  const [params] = useSearchParams();
  const rawReturn = params.get('returnTo');
  const returnTo = rawReturn ? safeReturnTo(rawReturn) : '/profile';
  const signedIn = state.status === 'signed-in';
  const me = useQuery<Me>(signedIn ? 'me' : null, async (c) => (await c.call('getMe', {})).data);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPrinciples, setShowPrinciples] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);

  useEffect(() => {
    if (me.data && !form) setForm(toForm(me.data));
  }, [me.data, form]);

  if (state.status === 'guest') return <Navigate to={signInPath(`/profile/edit${rawReturn ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)} replace />;
  if (!me.data || !form) return me.error ? <div className="body-pad"><FormError>{errorMessage(me.error)}</FormError></div> : <Loading />;
  const current = me.data;
  const gate = !current.profileGate.profileComplete || needsAcknowledgement(current);
  const set = (patch: Partial<ProfileForm>) => setForm({ ...form, ...patch });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const issues = validateProfile(form, current);
    setErrors(issues);
    setFormError('');
    if (Object.keys(issues).length) {
      setFormError(issues.acknowledged ?? 'Add your name (2+ characters), introduction (20+), London life, languages and interests.');
      return;
    }
    const body = toPatch(form, current);
    setBusy(true);
    try {
      const res = await intent.run({ body, v: current.version }, (key) =>
        api.client.call('updateMe', { body, ifMatch: current.version, idempotencyKey: key }));
      me.setData(res.data);
      await refresh();
      notify('Profile saved.');
      navigate(returnTo, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
        await me.reload(); // newer version for the next save; the user's edits stay in the form
      }
      setErrors(fieldErrorsOf(e));
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="body-pad" onSubmit={(e) => void save(e)} noValidate>
      {gate && <span className="eyebrow">ONE LAST INTRODUCTION</span>}
      <h1>{gate ? 'A face. A little story. You.' : 'Let people meet you.'}</h1>
      <p className="prose">{gate ? 'Give your future table a little context. Your email stays private.' : 'A little background makes the first hello easier.'}</p>
      {gate && rawReturn && <p className="muted">Complete your profile, then you’ll return to where you were. Nothing is sent until you choose to.</p>}
      <Field label="Your name" error={errors.displayName}>
        {(p) => <input {...p} autoComplete="given-name" maxLength={40} value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} />}
      </Field>
      <Field label="A little about you" hint="What brought you to London? What do you enjoy? 20–1,000 characters." error={errors.bio}>
        {(p) => <textarea {...p} rows={4} maxLength={1000} value={form.bio} onChange={(e) => set({ bio: e.target.value })} />}
      </Field>
      <ChoiceGroup label="London life" options={Object.entries(LIFE_STATUSES) as Array<[LifeStatusCode, string]>} value={form.lifeStatus} onChange={(v) => set({ lifeStatus: v })} />
      {errors.lifeStatus && <p className="field-error">{errors.lifeStatus}</p>}
      <ChoiceGroup multiple label="Languages" options={Object.entries(LANGUAGES) as Array<[LanguageCode, string]>} value={form.languages} onChange={(v) => set({ languages: toggle(form.languages, v) })} />
      {errors.languages && <p className="field-error">{errors.languages}</p>}
      <ChoiceGroup multiple label="We could talk about" options={Object.entries(INTERESTS) as Array<[InterestCode, string]>} value={form.interests} onChange={(v) => set({ interests: toggle(form.interests, v) })} />
      {errors.interests && <p className="field-error">{errors.interests}</p>}
      <Field label="Work · optional" error={errors.work}>
        {(p) => <input {...p} maxLength={150} value={form.work} onChange={(e) => set({ work: e.target.value })} />}
      </Field>
      <Field label="School · optional" error={errors.school}>
        {(p) => <input {...p} maxLength={150} value={form.school} onChange={(e) => set({ school: e.target.value })} />}
      </Field>
      <Field label="Hometown · optional" error={errors.hometown}>
        {(p) => <input {...p} maxLength={150} value={form.hometown} onChange={(e) => set({ hometown: e.target.value })} />}
      </Field>
      {needsAcknowledgement(current) && (
        <>
          <label className="create-consent">
            <input type="checkbox" checked={form.acknowledged} onChange={(e) => set({ acknowledged: e.target.checked })} />
            <span>I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first.</span>
          </label>
          <TextAction onClick={() => setShowPrinciples(true)}>Read privacy & community principles</TextAction>
        </>
      )}
      <FormError>{formError}</FormError>
      <Primary type="submit" disabled={busy}>{gate ? <>Take your seat <ArrowRightIcon /></> : <>Save profile <CheckIcon /></>}</Primary>
      <Sheet open={showPrinciples} onOpenChange={setShowPrinciples} title="Community & privacy principles">
        <CommunityPrinciples />
        <Primary secondary onClick={() => setShowPrinciples(false)}>Close</Primary>
      </Sheet>
    </form>
  );
}
