import { Link } from 'react-router';
import { INTERESTS, LIFE_STATUSES } from '@fancy/contracts';
import { GearIcon, GlobeIcon, PersonIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Me, PublicReview } from '../../api/types.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { Avatar, FormMessage, Loading, PageHeader, Pill, PrimaryLink, StateBlock, Tag } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { languageList } from './PublicProfilePage.tsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (instant: string) => MONTHS[new Date(instant).getUTCMonth()] ?? '';

/**
 * Profile tab (iOS MyProfileScreen): the member's own profile as their tables see it, published
 * references, Edit profile and the Settings entry. Guests are invited to sign in.
 */
export function ProfilePage() {
  const { state } = useSession();
  const signedIn = state.status === 'signed-in';
  useDocumentMeta({ title: 'Your profile · Fancy', robots: 'noindex, nofollow' });
  const me = useQuery<Me>(signedIn ? 'me' : null, async (c) => (await c.call('getMe', {})).data);
  const reviews = useQuery<PublicReview[]>(signedIn && me.data?.displayName ? `ownProfile:${me.data.id}:${me.data.version}` : null,
    async (c) => (await c.call('getPublicProfile', { params: { userId: me.data!.id } })).data.reviews);

  const gear = <Link className="disc" to="/settings" aria-label="Settings"><GearIcon width={18} height={18} aria-hidden="true" /></Link>;
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') {
    return (
      <div className="scroll">
        <PageHeader size="tab" title="Your profile" subtitle="How your tables get to know you." right={gear} />
        <StateBlock icon={<PersonIcon width={30} height={30} aria-hidden="true" />} title="Let your table get to know you."
          action={<><PrimaryLink to={signInPath('/profile')}>Sign in or create an account</PrimaryLink><PrimaryLink secondary to="/deletion-status">Check deletion status</PrimaryLink></>}>
          Sign in to set up the profile your tables will see.
        </StateBlock>
      </div>
    );
  }
  if (!me.data) return me.error ? <div className="scroll"><FormMessage message={errorMessage(me.error)} /></div> : <Loading />;
  const p = me.data;
  const facts = [p.background.work, p.background.school, p.background.hometown].filter(Boolean).join(' · ');
  return (
    <div className="scroll">
      <PageHeader size="tab" title="Your profile" subtitle="How your tables get to know you." right={gear} />
      <div className="profile-head">
        <Avatar name={p.displayName} url={p.avatarUrl} size={76} label={`${p.displayName ?? 'Your'} portrait`} />
        <h2 className="name">{p.displayName ?? 'New member'}</h2>
        {facts && <p className="facts-line">{facts}</p>}
        {p.lifeStatus && <Pill>{LIFE_STATUSES[p.lifeStatus]}</Pill>}
      </div>
      <div style={{ maxWidth: 360, margin: '14px auto 0' }}>
        {!p.profileGate.profileComplete && <PrimaryLink to="/profile-setup?returnTo=%2Fprofile">Finish your profile</PrimaryLink>}
        <PrimaryLink secondary to="/profile-edit" className={p.profileGate.profileComplete ? '' : 'mt8'}>Edit profile <PersonIcon aria-hidden="true" /></PrimaryLink>
      </div>
      <h2>A little about me</h2>
      <p className="prose">{p.bio ?? 'Not provided'}</p>
      <h2>We could talk about</h2>
      {p.interests.length ? <div className="tags">{p.interests.map((i) => <Tag key={i}>{INTERESTS[i]}</Tag>)}</div> : <p className="prose">Not provided</p>}
      <h2>Languages</h2>
      <p className="lang-line"><GlobeIcon width={18} height={18} aria-hidden="true" />{p.languages.length ? languageList(p.languages) : 'Not provided'}</p>
      <h2>Your shared meals</h2>
      {reviews.data?.length ? reviews.data.map((r) => (
        <blockquote className="quote" key={r.id} style={{ margin: '0 0 8px' }}>{`“${r.body}”`}<small>{`${r.author.displayName} · Shared a meal in ${monthName(r.publishedAt)}`}</small></blockquote>
      )) : <p className="muted">No published references yet. Your first table is a good place to start.</p>}
    </div>
  );
}
