import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError, newIntentKey } from '@fancy/client';
import { INTERESTS, LANGUAGES, LEGACY_LANGUAGE_LABELS, LIFE_STATUSES, type InterestCode, type LanguageCode, type LifeStatusCode } from '@fancy/contracts';
import { ArrowRightIcon, CheckIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage, fieldErrorsOf } from '../../api/errors.ts';
import type { Me, MePatch } from '../../api/types.ts';
import { safeReturnTo, signInPath } from '../../lib/returnTo.ts';
import { Avatar, ChoiceGroup, Field, FormMessage, Loading, PageHeader, Primary, Required, TextAction, TitleBar } from '../../ui/components.tsx';
import { useToast } from '../../ui/toast.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { AGE_CONFIRMATION_VERSION, COMMUNITY_PRINCIPLES_VERSION } from '../auth/consentVersions.ts';
import { PhotoError, preparePhoto, savePhoto } from './photo.ts';

export interface ProfileForm {
  displayName: string; bio: string; lifeStatus: LifeStatusCode | null; languages: LanguageCode[]; interests: InterestCode[];
  work: string; school: string; hometown: string; acknowledged: boolean;
}
type FieldKey = 'displayName' | 'bio' | 'lifeStatus' | 'languages' | 'interests' | 'background' | 'acknowledged';

const toForm = (me: Me): ProfileForm => ({
  displayName: me.displayName ?? '', bio: me.bio ?? '', lifeStatus: me.lifeStatus, languages: [...me.languages], interests: [...me.interests],
  work: me.background.work ?? '', school: me.background.school ?? '', hometown: me.background.hometown ?? '', acknowledged: false,
});
export const needsAcknowledgement = (me: Me) => !me.profileGate.ageConfirmed || !me.profileGate.communityAccepted;

/** iOS profile/model.ts: same boundaries as the API (name 2–40, bio 20–1,000), checked in field order. */
export function validateProfile(form: ProfileForm, requireConsent: boolean): { field: FieldKey; message: string } | null {
  const name = form.displayName.trim();
  const bio = form.bio.trim();
  if (name.length < 2 || name.length > 40) return { field: 'displayName', message: 'Add a name of 2–40 characters.' };
  if (bio.length < 20 || bio.length > 1000) return { field: 'bio', message: 'Write an introduction of 20–1,000 characters.' };
  if (!form.lifeStatus) return { field: 'lifeStatus', message: 'Choose your life in London.' };
  if (form.languages.length < 1) return { field: 'languages', message: 'Choose a conversation language.' };
  if (form.interests.length < 1) return { field: 'interests', message: 'Choose at least one interest.' };
  for (const key of ['work', 'school', 'hometown'] as const) if (form[key].trim().length > 150) return { field: 'background', message: 'Keep work, school and hometown to 150 characters each.' };
  if (requireConsent && !form.acknowledged) return { field: 'acknowledged', message: 'Confirm the age and community acknowledgement to continue.' };
  return null;
}

export function toPatch(form: ProfileForm, me: Me): MePatch {
  const background: NonNullable<MePatch['background']> = {};
  for (const key of ['work', 'school', 'hometown'] as const) { const v = form[key].trim(); if (v) background[key] = v; }
  return {
    displayName: form.displayName.trim(), bio: form.bio.trim(), ...(form.lifeStatus ? { lifeStatus: form.lifeStatus } : {}),
    languages: form.languages, interests: form.interests, background,
    ...(needsAcknowledgement(me) && form.acknowledged ? { ageConfirmedVersion: AGE_CONFIRMATION_VERSION, communityAcceptedVersion: COMMUNITY_PRINCIPLES_VERSION } : {}),
  };
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
/** Setup offers the prototype's single language choices (iOS LANGUAGE_CHOICE_LABELS); edit allows several. */
const LANGUAGE_CHOICES = ['English', 'Mandarin', 'French', 'Spanish', 'Hindi', 'English & Mandarin', 'English & French'] as const;
const choiceCodes = (label: string) => [...(LEGACY_LANGUAGE_LABELS[label] ?? [])];
const choiceFor = (codes: readonly LanguageCode[]) => LANGUAGE_CHOICES.find((l) => [...choiceCodes(l)].sort().join(',') === [...codes].sort().join(',')) ?? null;
const languageOptions = (Object.entries(LANGUAGES) as Array<[LanguageCode, string]>).map(([c, l]) => [c, c === 'zh' ? 'Mandarin' : l] as const);

/** Photo control (iOS ProfilePhotoField): saves on its own, independent of the form's Save button. */
function PhotoField({ me, name, onSaved }: { me: Me; name: string; onSaved: (me: Me) => void }) {
  const { api } = useApi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = !!me.avatarUrl;
  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setConfirming(false);
    let data: string;
    try { data = await preparePhoto(file); } catch (e) { setError(e instanceof PhotoError ? e.message : 'We couldn’t read this photo. Please choose another one.'); return; }
    setBusy('upload');
    const res = await savePhoto(api.client, { upload: data }, me.version, newIntentKey);
    setBusy(null);
    if (res.kind === 'saved') onSaved(res.me); else setError(res.message);
  };
  const remove = async () => {
    setError(null);
    setBusy('remove');
    const res = await savePhoto(api.client, 'remove', me.version, newIntentKey);
    setBusy(null);
    setConfirming(false);
    if (res.kind === 'saved') onSaved(res.me); else setError(res.message);
  };
  return (
    <div className="field">
      <span className="flabel" id="photo-label">Profile photo</span>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Avatar name={name.trim() || me.displayName || '?'} url={me.avatarUrl} size={64} />
        <div style={{ flex: 1 }}>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="vh" aria-labelledby="photo-label" tabIndex={-1} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
          {busy ? <p className="muted" role="status">{busy === 'upload' ? 'Uploading your photo…' : 'Removing your photo…'}</p>
            : confirming ? (
              <>
                <p className="muted">Remove your photo? Your tables will see your initial instead.</p>
                <div style={{ display: 'flex', gap: 18 }}><TextAction className="inline" danger onClick={() => void remove()}>Remove photo</TextAction><TextAction className="inline" onClick={() => setConfirming(false)}>Cancel</TextAction></div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 18 }}>
                  <TextAction className="inline" onClick={() => input.current?.click()}>{hasPhoto ? 'Change photo' : 'Upload photo'}</TextAction>
                  {hasPhoto && <TextAction className="inline" danger onClick={() => { setError(null); setConfirming(true); }}>Remove</TextAction>}
                </div>
                <p className="muted">{hasPhoto ? 'Your tables see this photo.' : 'Optional. Without a photo, your tables see your initial.'}</p>
              </>
            )}
        </div>
      </div>
      <FormMessage message={error} />
    </div>
  );
}

/**
 * `/profile-setup` (profile gate: 18+, community, required fields) and `/profile-edit` (iOS
 * ProfileSetupScreen / EditProfileScreen). With `returnTo`, saving goes back to the interrupted page,
 * whose draft is restored but never auto-submitted.
 */
export function ProfileEditPage({ mode = 'edit' }: { mode?: 'setup' | 'edit' }) {
  const { api } = useApi();
  const { state, refresh } = useSession();
  const navigate = useNavigate();
  const notify = useToast();
  const [params] = useSearchParams();
  const rawReturn = params.get('returnTo') ?? params.get('next');
  const returnTo = rawReturn ? safeReturnTo(rawReturn) : mode === 'setup' ? '/discover' : '/profile';
  const signedIn = state.status === 'signed-in';
  const me = useQuery<Me>(signedIn ? 'me' : null, async (c) => (await c.call('getMe', {})).data);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [issue, setIssue] = useState<{ field: FieldKey | null; message: string } | null>(null);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const formRef = useRef<HTMLFormElement>(null);
  useDocumentMeta({ title: mode === 'setup' ? 'Your profile · Fancy' : 'Edit profile · Fancy', robots: 'noindex, nofollow' });

  useEffect(() => { if (me.data && !form) setForm(toForm(me.data)); }, [me.data, form]);
  useEffect(() => {
    if (!issue?.field) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView?.({ block: 'center' });
  }, [issue]);

  const here = `/${mode === 'setup' ? 'profile-setup' : 'profile-edit'}${rawReturn ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  if (state.status === 'guest') return <Navigate to={signInPath(here)} replace />;
  if (!me.data || !form) return me.error ? <div className="scroll"><FormMessage message={errorMessage(me.error)} /></div> : <Loading />;
  const current = me.data;
  const requireConsent = mode === 'setup' && needsAcknowledgement(current);
  const set = (patch: Partial<ProfileForm>) => { setForm({ ...form, ...patch }); };
  const err = (f: FieldKey) => (issue?.field === f ? issue.message : serverFields[f] ?? null);
  const photoSaved = (next: Me) => { me.setData(next); void refresh(); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateProfile(form, requireConsent);
    setServerFields({});
    if (invalid) { setIssue(invalid); return; }
    const body = toPatch(form, current);
    setBusy(true);
    setIssue(null);
    try {
      const res = await intent.run({ body, v: current.version }, (key) => api.client.call('updateMe', { body, ifMatch: current.version, idempotencyKey: key }));
      me.setData(res.data);
      await refresh();
      if (mode === 'setup' && !res.data.profileGate.profileComplete) { setIssue({ field: null, message: 'A few details are still missing.' }); return; }
      notify(mode === 'setup' ? 'Profile saved' : 'Profile updated');
      navigate(returnTo, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') await me.reload(); // newer version for the next save; edits stay
      setServerFields(fieldErrorsOf(e));
      setIssue({ field: null, message: e instanceof ApiError && e.code === 'VERSION_CONFLICT' ? 'Your profile was updated elsewhere. Review your details and save again.' : errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} className="scroll has-footer" onSubmit={(e) => void save(e)} noValidate>
      {mode === 'setup'
        ? <PageHeader title="A face. A little story. You." subtitle="Give your future table a little context. Your email stays private." />
        : <TitleBar title="Let people meet you." subtitle="A little background makes the first hello easier." back="/profile" />}
      {mode === 'setup' && rawReturn && <p className="muted" style={{ marginBottom: 12 }}>Complete your profile, then you’ll return to where you were. Nothing is sent until you choose to.</p>}
      <PhotoField me={current} name={form.displayName} onSaved={photoSaved} />
      <Field label="First name" required error={err('displayName')}>
        {(p) => <input {...p} className="input" autoComplete="given-name" placeholder="Alex" maxLength={40} value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} />}
      </Field>
      <Field label="A little about you" required hint="At least 20 characters. Share what you’re comfortable making public." counter={`${form.bio.length}/1,000`} error={err('bio')}>
        {(p) => <textarea {...p} className="textarea" rows={4} maxLength={1000} placeholder="What brought you to London? What do you enjoy?" value={form.bio} onChange={(e) => set({ bio: e.target.value })} />}
      </Field>
      <ChoiceGroup label="Your life in London" required options={Object.entries(LIFE_STATUSES) as Array<[LifeStatusCode, string]>} value={form.lifeStatus} onChange={(v) => set({ lifeStatus: v })} error={err('lifeStatus')} />
      {mode === 'setup' ? (
        <ChoiceGroup<string> label="Conversation language" required options={LANGUAGE_CHOICES.map((l) => [l, l] as const)} value={choiceFor(form.languages)} onChange={(l) => set({ languages: choiceCodes(l) })} error={err('languages')} />
      ) : (
        <ChoiceGroup<LanguageCode> multiple label="Conversation languages · choose one or more" required options={languageOptions} value={form.languages} onChange={(v) => set({ languages: toggle(form.languages, v) })} error={err('languages')} />
      )}
      <ChoiceGroup<InterestCode> multiple label="Interests · choose one or more" required options={Object.entries(INTERESTS) as Array<[InterestCode, string]>} value={form.interests} onChange={(v) => set({ interests: toggle(form.interests, v) })} error={err('interests')} />
      {mode === 'edit' ? (
        <>
          <Field label="Work" error={err('background')}>{(p) => <input {...p} className="input" maxLength={150} value={form.work} onChange={(e) => set({ work: e.target.value })} />}</Field>
          <Field label="School">{(p) => <input {...p} className="input" maxLength={150} value={form.school} onChange={(e) => set({ school: e.target.value })} />}</Field>
          <Field label="Hometown">{(p) => <input {...p} className="input" maxLength={150} value={form.hometown} onChange={(e) => set({ hometown: e.target.value })} />}</Field>
        </>
      ) : <p className="muted">Add work, school, hometown and more interests in Edit profile whenever you like.</p>}
      {requireConsent && (
        <div className="field" style={{ marginTop: 14 }}>
          <label className="check">
            <input type="checkbox" checked={form.acknowledged} aria-invalid={err('acknowledged') ? true : undefined} onChange={(e) => set({ acknowledged: e.target.checked })} />
            <span>I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first.<Required /></span>
          </label>
          <p className="muted">Taking your seat means you agree to the <a className="inline-link" href="/terms/">Terms of use</a> and <a className="inline-link" href="/guidelines/">Community guidelines</a>. The <a className="inline-link" href="/privacy/">Privacy notice</a> explains how your information is used.</p>
        </div>
      )}
      <div className="footer">
        <FormMessage message={issue && (!issue.field || issue.field === 'acknowledged') ? issue.message : null} />
        <Primary type="submit" busy={busy}>{mode === 'setup' ? <>Take your seat <ArrowRightIcon aria-hidden="true" /></> : <>Save profile <CheckIcon aria-hidden="true" /></>}</Primary>
      </div>
    </form>
  );
}
