import { INTERESTS, LANGUAGES, type InterestCode, type LanguageCode } from '@fancy/contracts';
import type { PublicReview } from '../../api/types.ts';
import { longDate } from '../../lib/format.ts';

export const languageList = (codes: readonly LanguageCode[]) => codes.map((c) => LANGUAGES[c]).join(' & ');

export function InterestTags({ codes }: { codes: readonly InterestCode[] }) {
  return <div className="tags">{codes.map((c) => <span key={c}>{INTERESTS[c]}</span>)}</div>;
}

/** Only published references reach the client (public projection, API §2). */
export function References({ reviews, empty }: { reviews: readonly PublicReview[]; empty: string }) {
  if (!reviews.length) return <p className="muted">{empty}</p>;
  return (
    <>
      {reviews.map((r) => (
        <div className="quote" key={r.id}>
          “{r.body}”
          <small>{r.author.displayName} · Shared a meal · {longDate(r.publishedAt.slice(0, 10))}</small>
        </div>
      ))}
    </>
  );
}
