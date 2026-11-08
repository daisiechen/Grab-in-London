import { useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '@fancy/client';
import { INTERESTS, LANGUAGES, type LanguageCode } from '@fancy/contracts';
import { ExclamationTriangleIcon, GlobeIcon } from '@radix-ui/react-icons';
import { useRenderedEvent } from '../../api/telemetry.tsx';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { useSignedIn } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import type { PublicProfile, PublicReview } from '../../api/types.ts';
import { Avatar, FormMessage, LinkRow, Primary, StateBlock, Tag, TextAction, TitleBar } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { Unavailable } from '../../app/NotFound.tsx';
import { MemberSafety } from '../connections/MemberSafety.tsx';

interface ProfileData { profile: PublicProfile; reviews: PublicReview[]; nextReviewCursor: string | null }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (instant: string) => MONTHS[new Date(instant).getUTCMonth()] ?? '';
export const languageList = (codes: readonly LanguageCode[]) => codes.map((c) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c])).join(' · ');

/**
 * Guest-readable public profile (iOS PublicProfileScreen): portrait, background, introduction,
 * interests, languages, published references, block and report. Never indexed by search engines (D4).
 */
export function PublicProfilePage() {
  const { userId = '' } = useParams();
  const { api } = useApi();
  const viewer = useSignedIn();
  const q = useQuery<ProfileData>(`profile:${userId}`, async (c) => (await c.call('getPublicProfile', { params: { userId } })).data);
  const [more, setMore] = useState<{ reviews: PublicReview[]; cursor: string | null } | null>(null);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  useRenderedEvent('profile_view', { userId }, !!q.data);
  const profile = q.data?.profile.id === userId ? q.data.profile : null;
  useDocumentMeta(profile ? { title: `${profile.displayName} on Fancy`, robots: 'noindex', canonical: `/profiles/${profile.id}` } : { title: 'Member profile · Fancy', robots: 'noindex' });

  if (!profile || !q.data) {
    if (q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403)) return <Unavailable kind="profile" />;
    return (
      <div className="scroll">
        <TitleBar title={q.error ? 'Member profile' : <span className="sk" style={{ height: 24, width: 160 }} />} />
        {q.error ? <StateBlock title="We couldn’t load this profile." action={<Primary onClick={() => void q.reload()}>Try again</Primary>}>Check your connection and try again.</StateBlock>
          : <p className="vh" role="status">Loading profile</p>}
      </div>
    );
  }
  const reviews = [...q.data.reviews, ...(more?.reviews ?? [])];
  const cursor = more ? more.cursor : q.data.nextReviewCursor;
  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.client.call('getPublicProfile', { params: { userId }, query: { cursor } });
      setMore({ reviews: [...(more?.reviews ?? []), ...res.data.reviews], cursor: res.data.nextReviewCursor });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };
  const facts = [profile.background?.work, profile.background?.school, profile.background?.hometown].filter(Boolean).join(' · ');
  const self = viewer?.user.id === profile.id;

  return (
    <div className="scroll">
      <TitleBar title={profile.displayName} subtitle={facts || 'Member of Fancy'} />
      <div className="pgrid">
        <div className="pcard">
          <div className="profile-head">
            <Avatar name={profile.displayName} url={profile.avatarUrl} size={76} label={`${profile.displayName} portrait`} />
          </div>
          <h2>We could talk about</h2>
          {profile.interests.length ? <div className="tags">{profile.interests.map((i) => <Tag key={i}>{INTERESTS[i]}</Tag>)}</div> : <p className="prose">Not provided</p>}
          <h2>Languages</h2>
          <p className="lang-line"><GlobeIcon width={18} height={18} aria-hidden="true" />{profile.languages.length ? languageList(profile.languages) : 'Not provided'}</p>
        </div>
        <div>
          <h2>A little about me</h2>
          <p className="prose">{profile.bio ?? 'Not provided'}</p>
          <h2>From people at the table</h2>
          {reviews.length === 0 ? <p className="muted">No public references yet.</p> : reviews.map((r) => (
            <blockquote className="quote" key={r.id} style={{ margin: '0 0 8px' }}>
              {`“${r.body}”`}
              <small>{`${r.author.displayName} · Shared a meal in ${monthName(r.publishedAt)}`}</small>
            </blockquote>
          ))}
          {cursor && <TextAction disabled={loadingMore} onClick={() => void loadMore()}>Show more references</TextAction>}
          <FormMessage message={error} />
          {!self && (
            <div style={{ marginTop: 16 }}>
              <MemberSafety subjectId={profile.id} name={profile.displayName} />
              <LinkRow first icon={<ExclamationTriangleIcon width={14} height={14} />} label="Report this profile" to={`/report?targetType=USER&targetId=${profile.id}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
