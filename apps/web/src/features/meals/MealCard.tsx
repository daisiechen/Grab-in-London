import { Link } from 'react-router';
import { CalendarIcon, ChatBubbleIcon, PersonIcon, SewingPinIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import type { Meal } from '../../api/types.ts';
import { Avatar } from '../../ui/components.tsx';
import { mealPath } from '../../seo/meal-seo.ts';
import { VenuePhoto } from '../venues/VenuePhoto.tsx';
import { areaName, areaPlace, cardBudgetLabel, cardWhenLabel, languagesLabel, mealPeople, moodLabel, venueName } from './present.ts';

type Variant = 'default' | 'compact' | 'dense' | 'tile';

/** Meta row: every line starts with the same 12px icon column so the text aligns; price uses a £ glyph. */
function Line({ icon, glyph, children }: { icon?: ReactNode; glyph?: string; children: string }) {
  return <div className="ln"><span className="ic" aria-hidden="true">{icon ?? <span className="glyph">{glyph}</span>}</span><span>{children}</span></div>;
}

/**
 * iOS MealCard: photo frame + copy. The whole card is one link (a sibling, never a parent, of
 * the avatar links, so each person stays separately focusable). `dense` is the two-up map
 * preview, `compact` the list, `tile` the homepage card. The photo credit sits under the card.
 */
export function MealCard({ meal, variant = 'default', compact, status, statusTone, to, linkState, people = true }: {
  meal: Meal; variant?: Variant; compact?: boolean; status?: string | undefined; statusTone?: 'bad'; to?: string; linkState?: unknown; people?: boolean; backTo?: string;
}) {
  const kind: Variant = compact ? 'compact' : variant;
  const href = to ?? mealPath(meal);
  const members = mealPeople(meal).slice(0, 3);
  const budget = `${cardBudgetLabel(meal).replace(/^£/, '')} per person`;
  const seats = `Table for ${meal.capacity} · ${meal.confirmedCount} confirmed`;
  return (
    <VenuePhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} label={meal.venue.name}>
      {({ image, attribution }) => (
        <article className={kind === 'tile' ? 'tile' : `card ${kind}`} aria-label={meal.title}>
          <Link className="hit" to={href} state={linkState} aria-label={`Open ${meal.title}`} />
          {kind === 'tile' ? (
            <>
              {image}
              <div className="tc">
                <h3>{meal.title}</h3>
                <div className="venue">{`${venueName(meal)} · ${areaName(meal.areaCode)}`}</div>
                <Line icon={<CalendarIcon width={12} height={12} />}>{cardWhenLabel(meal.startsAt)}</Line>
                <Line glyph="£">{budget}</Line>
                <Line icon={<PersonIcon width={12} height={12} />}>{seats}</Line>
              </div>
            </>
          ) : (
            <div className="cbody">
              {image}
              <div className="copy">
                <h3>{meal.title}</h3>
                {kind === 'dense' ? (
                  <>
                    <div className="venue">{`${venueName(meal)} · ${areaName(meal.areaCode)}`}</div>
                    <Line icon={<CalendarIcon width={12} height={12} />}>{cardWhenLabel(meal.startsAt)}</Line>
                    <Line glyph="£">{budget}</Line>
                    <Line icon={<PersonIcon width={12} height={12} />}>{seats}</Line>
                  </>
                ) : (
                  <>
                    <div className="venue">{venueName(meal)}</div>
                    <Line icon={<SewingPinIcon width={12} height={12} />}>{areaPlace(meal.areaCode)}</Line>
                    <Line icon={<CalendarIcon width={12} height={12} />}>{cardWhenLabel(meal.startsAt)}</Line>
                    <Line glyph="£">{budget}</Line>
                    <Line icon={<PersonIcon width={12} height={12} />}>{seats}</Line>
                    <Line icon={<ChatBubbleIcon width={12} height={12} />}>{`${moodLabel(meal.mood)} · ${languagesLabel(meal.languages)}`}</Line>
                    {people && (
                      <div className="av-row">
                        {members.map((p) => (
                          <Link key={p.id} className="avatar-link" to={`/profiles/${p.id}`} aria-label={`View ${p.displayName}’s profile`}>
                            <Avatar name={p.displayName} url={p.avatarUrl} size={kind === 'compact' ? 26 : 28} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {status ? <p className={`status${statusTone ? ` ${statusTone}` : ''}`}>{status}</p> : null}
          {meal.status === 'CANCELLED' && kind !== 'tile' ? <p className="status bad">Cancelled</p> : null}
          {attribution}
        </article>
      )}
    </VenuePhoto>
  );
}
