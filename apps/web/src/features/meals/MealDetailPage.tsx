import {MealShare} from '../share/MealShare.tsx';
import {VenuePhoto} from '../venues/VenuePhoto.tsx';
import {mealReturn} from '../discover/returnContext.ts';
import { Link,useLocation,useParams } from 'react-router';
import { useRenderedEvent } from '../../api/telemetry.tsx';
import { ArrowRightIcon, CalendarIcon, ChatBubbleIcon, ExternalLinkIcon, InfoCircledIcon, PersonIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { useSignedIn } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { MealDetail } from '../../api/types.ts';
import { budgetRange, longDate, timeLabel, zonedLabel } from '../../lib/format.ts';
import { Avatar, FormError, Loading, PageHeader, PrimaryLink } from '../../ui/components.tsx';
import {
  applicationLabels, areaName, bookingStatus, cancelReasonLabel, cuisineLabel, dietaryLabel, googleMapsUrl, languagesLabel, moodLabel, tableKind,
} from './present.ts';

/**
 * Public meal detail (T08). Guests see the public projection; signed-in users also get their
 * own application progress. Buttons follow the server's allowedActions hints; the server
 * re-validates every action. External booking, pay at the restaurant only (P-01).
 */
export function MealDetailPage() {
  const { mealId = '' } = useParams();
  const source:unknown=useLocation().state;
  const backTo=mealReturn(source&&typeof source==='object'&&'backTo'in source?source.backTo:null);
  const profileSource={backTo:`/meals/${mealId}`,mealBackTo:backTo};
  const signedIn = useSignedIn();
  const q = useQuery<MealDetail>(`meal:${mealId}:${signedIn?.user.id ?? 'guest'}`, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  useRenderedEvent('detail_view',{mealId},!!q.data);

  if (!q.data) return q.error ? <><PageHeader title="The table" backTo={backTo} /><div className="body-pad"><FormError>{errorMessage(q.error)}</FormError></div></> : <Loading />;
  const { meal, myApplication, conversationId } = q.data;
  const actions = new Set(meal.allowedActions);
  const isHost = signedIn?.user.id === meal.host.id;
  const booking = bookingStatus(meal);
  const cancelled = meal.status === 'CANCELLED';

  return (
    <>
      <PageHeader title="The table" backTo={backTo} />
      <VenuePhoto className="detail-hero" venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} label={meal.venue.name}/>
      <div className="body-pad">
        <div className="eyebrow">{areaName(meal.areaCode).toUpperCase()} · {tableKind(meal.capacity)}</div>
        <h1>{meal.title}</h1>
        <MealShare key={`${meal.id}:${meal.version}`} meal={{id:meal.id,title:meal.title,startsAt:meal.startsAt,area:areaName(meal.areaCode),status:meal.status}}/>
        <div className="fact-grid">
          <div><CalendarIcon /><strong>{longDate(meal.startsAt.localDate)}</strong><span>{timeLabel(meal.startsAt)}</span></div>
          <div><PersonIcon /><strong>{meal.confirmedCount} of {meal.capacity} confirmed</strong><span>Including the host</span></div>
        </div>
        <div className="host-line">
          <Link to={`/profiles/${meal.host.id}`} state={profileSource} aria-label={`Host ${meal.host.displayName}`}><Avatar name={meal.host.displayName} url={meal.host.avatarUrl} size={44} /></Link>
          <div>
            <small>Your host</small>
            <Link to={`/profiles/${meal.host.id}`} state={profileSource}><strong>{meal.host.displayName}</strong></Link>
          </div>
          <span className="pill">{languagesLabel(meal.languages)}</span>
        </div>
        <h2>A little about this meal</h2>
        <p className="prose">{meal.description}</p>
        <div className="tags"><span>{moodLabel(meal.mood)}</span><span>Friendship first</span></div>

        <h2>Food & dietary</h2>
        <ul className="declared-list">
          <li><span>Cuisine</span><strong>{cuisineLabel(meal)}</strong></li>
          <li><span>Dietary options</span><strong>{dietaryLabel(meal)}</strong></li>
        </ul>
        <p className="muted">Declared by the host. Not a guarantee for allergies; check with the restaurant.</p>

        <h2>Who’s coming</h2>
        <p className="muted">
          {meal.minimum}–{meal.capacity} people including the host · Applications close {zonedLabel(meal.closesAt)}
        </p>
        {cancelled && <div className="notice" role="status">{meal.cancelReason ? cancelReasonLabel[meal.cancelReason] : 'This meal was cancelled.'} Existing members can still chat in Inbox.</div>}

        <h2>The restaurant</h2>
        <div className="venue-line">
          <SewingPinIcon />
          <div>
            {meal.venue.available ? (
              <><strong>{meal.venue.name}</strong><p>{meal.venue.address ?? `${areaName(meal.areaCode)}, London`}</p></>
            ) : (
              <><strong>Restaurant information temporarily unavailable</strong><p>{areaName(meal.areaCode)}, London</p></>
            )}
            <span className={`status-tag ${booking.tone}`}>{booking.label}</span>
            {meal.venue.attributions.map((a, i) => <p className="attribution" key={i}>{a.text}</p>)}
          </div>
        </div>
        {meal.venue.available && (
          <a className="maps-link" href={googleMapsUrl(meal.venue)} target="_blank" rel="noopener noreferrer">
            Open {meal.venue.name} in Google Maps <ExternalLinkIcon />
          </a>
        )}
        <p className="map-destination-note">Reservation reported by the host; not verified by the app.</p>

        <h2>Keeping costs clear</h2>
        <div className="price-row"><span>Expected spend per person</span><strong>{budgetRange(meal.budgetMinPence, meal.budgetMaxPence)}</strong></div>
        <div className="price-row"><span>Pay at the restaurant</span><strong>Split the bill</strong></div>
        <p className="muted">No payment is due in the app. Everyone pays their own share at the restaurant.</p>
        <div className="notice"><InfoCircledIcon /><span>No in-app payment to refund. Let the host know if your plans change.</span></div>

        {myApplication && !isHost && (
          <div className="summary-box">
            <strong>Your request</strong>
            <p><span className="status-tag">{applicationLabels[myApplication.state]}</span></p>
          </div>
        )}
        {actions.has('APPLY') && <PrimaryLink to={`/meals/${meal.id}/apply`}>{myApplication ? 'Apply again' : 'Request to join'} <ArrowRightIcon /></PrimaryLink>}
        {!signedIn && !cancelled && !actions.has('APPLY') && meal.status === 'OPEN' && (
          <PrimaryLink to={`/meals/${meal.id}/apply`}>Request to join <ArrowRightIcon /></PrimaryLink>
        )}
        {(actions.has('WITHDRAW') || actions.has('LEAVE')) && myApplication && <PrimaryLink secondary to={`/meals/${meal.id}/apply`}>View application</PrimaryLink>}
        {actions.has('REVIEW_APPLICATIONS') && <PrimaryLink to={`/meals/${meal.id}/host`}>Manage guest list</PrimaryLink>}
        {actions.has('EDIT') && <PrimaryLink secondary to={`/meals/${meal.id}/edit`}>Edit arrangements</PrimaryLink>}
        {actions.has('OPEN_GROUP') && conversationId && <PrimaryLink secondary to={`/inbox/${conversationId}`}>Open meal group <ChatBubbleIcon /></PrimaryLink>}
        {actions.has('POST_MEAL') && <PrimaryLink secondary to={`/post-meal/${meal.id}`}>After the meal</PrimaryLink>}
      </div>
    </>
  );
}
