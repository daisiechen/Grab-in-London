import { useState } from 'react';
import { useRenderedEvent } from '../../api/telemetry.tsx';
import {useLocation,useParams} from 'react-router';
import { GlobeIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { PublicProfile, PublicReview } from '../../api/types.ts';
import { Avatar, FormError, Loading, PageHeader, TextAction } from '../../ui/components.tsx';
import { InterestTags, References, languageList } from './ProfileView.tsx';
import { useSignedIn } from '../../api/session.tsx';
import { MemberSafety } from '../connections/MemberSafety.tsx';

interface ProfileData { profile: PublicProfile; reviews: PublicReview[]; nextReviewCursor: string | null }

/** Guest-readable public projection: no contact details, itinerary or private choices. */
export function PublicProfilePage() {
  const { userId = '' } = useParams();
  const source:unknown=useLocation().state;
  const candidate=source&&typeof source==='object'&&'backTo'in source?source.backTo:null;
  const backTo=typeof candidate==='string'&&/^\/meals\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)?candidate:'/discover';
  const mealBackTo=source&&typeof source==='object'&&'mealBackTo'in source&&source.mealBackTo==='/meals?section=HOSTING'?'/meals?section=HOSTING':'/discover';
  const { api } = useApi();
  const viewer = useSignedIn();
  const q = useQuery<ProfileData>(`profile:${userId}`, async (c) => (await c.call('getPublicProfile', { params: { userId } })).data);
  const [more, setMore] = useState<{ reviews: PublicReview[]; cursor: string | null } | null>(null);
  const [error, setError] = useState('');
  useRenderedEvent('profile_view',{userId},!!q.data);

  if (!q.data) return q.error ? <div className="body-pad"><FormError>{errorMessage(q.error)}</FormError></div> : <Loading />;
  const { profile } = q.data;
  const reviews = [...q.data.reviews, ...(more?.reviews ?? [])];
  const cursor = more ? more.cursor : q.data.nextReviewCursor;
  const loadMore = async () => {
    if (!cursor) return;
    try {
      const res = await api.client.call('getPublicProfile', { params: { userId }, query: { cursor } });
      setMore({ reviews: [...(more?.reviews ?? []), ...res.data.reviews], cursor: res.data.nextReviewCursor });
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader title={profile.displayName} backTo={backTo} backState={backTo==='/discover'?undefined:{backTo:mealBackTo}} />
      <div className="body-pad">
        <div className="profile-heading">
          <Avatar name={profile.displayName} url={profile.avatarUrl} size={88} />
          <h1>{profile.displayName}</h1>
          {profile.background?.work && <p>{profile.background.work}</p>}
        </div>
        {profile.bio && <><h2>A little about me</h2><p className="prose">{profile.bio}</p></>}
        {!!profile.interests.length && <><h2>We could talk about</h2><InterestTags codes={profile.interests} /></>}
        {!!profile.languages.length && <><h2>Languages</h2><p><GlobeIcon /> {languageList(profile.languages)}</p></>}
        {profile.background?.hometown && <><h2>Hometown</h2><p>{profile.background.hometown}</p></>}
        <h2>From people at the table</h2>
        <References reviews={reviews} empty="No published references yet." />
        {cursor && <TextAction onClick={() => void loadMore()}>Show more references</TextAction>}
        <FormError>{error}</FormError>
        {viewer && viewer.user.id !== profile.id && <MemberSafety subjectId={profile.id} name={profile.displayName} />}
      </div>
    </>
  );
}
