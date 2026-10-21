import { Link } from 'react-router';
import { LIFE_STATUSES } from '@fancy/contracts';
import { ArrowRightIcon, GearIcon, PersonIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Me, PublicReview } from '../../api/types.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { Avatar, FormError, Loading, PrimaryLink } from '../../ui/components.tsx';
import { InterestTags, References, languageList } from './ProfileView.tsx';

export function ProfilePage() {
  const { state } = useSession();
  const signedIn = state.status === 'signed-in';
  const me = useQuery<Me>(signedIn ? 'me' : null, async (c) => (await c.call('getMe', {})).data);
  const reviews = useQuery<PublicReview[]>(signedIn && me.data ? `profile:${me.data.id}` : null,
    async (c) => (await c.call('getPublicProfile', { params: { userId: me.data!.id } })).data.reviews);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') {
    return (
      <div className="body-pad">
        <span className="eyebrow">LONDON, LET’S EAT.</span>
        <h1>Fancy a bite?</h1>
        <p className="prose">Meet new people over a meal.</p>
        <PrimaryLink to={signInPath('/profile')}>Sign in or create an account <ArrowRightIcon /></PrimaryLink>
      </div>
    );
  }
  if (!me.data) return me.error ? <div className="body-pad"><FormError>{errorMessage(me.error)}</FormError></div> : <Loading />;
  const p = me.data;
  return (
    <div className="body-pad">
      <div className="profile-settings-entry">
        <Link to="/settings" aria-label="Settings"><GearIcon /> Settings</Link>
      </div>
      <div className="profile-heading">
        <Avatar name={p.displayName} size={82} />
        <h1>{p.displayName ?? 'Your profile'}</h1>
        {p.background.work && <p>{p.background.work}</p>}
        {p.lifeStatus && <span className="pill">{LIFE_STATUSES[p.lifeStatus]}</span>}
      </div>
      {!p.profileGate.profileComplete && <div className="notice">Complete your profile before applying or hosting.</div>}
      <PrimaryLink to="/profile/edit" secondary>Edit profile <PersonIcon /></PrimaryLink>
      <h2>A little about me</h2>
      <p className="prose">{p.bio ?? 'Add a short introduction so your table can say hello.'}</p>
      <h2>We could talk about</h2>
      <InterestTags codes={p.interests} />
      <h2>Languages</h2>
      <p>{languageList(p.languages) || 'Not added yet'}</p>
      {p.background.hometown && <><h2>Hometown</h2><p>{p.background.hometown}</p></>}
      {p.background.school && <><h2>School</h2><p>{p.background.school}</p></>}
      <h2>Your shared meals</h2>
      <References reviews={reviews.data ?? []} empty="No published references yet. Your first table is a good place to start." />
    </div>
  );
}
