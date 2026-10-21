import { Link } from 'react-router';
import { CalendarIcon, PersonIcon, SewingPinIcon } from '@radix-ui/react-icons';
import type { Meal } from '../../api/types.ts';
import { budgetRange, longDate } from '../../lib/format.ts';
import { Avatar } from '../../ui/components.tsx';
import { areaName, languagesLabel, monogram, moodLabel } from './present.ts';

/** Prototype mealCard: whole-card hit link is a sibling of the host avatar link, never nested. */
export function MealCard({ meal, compact = false, backTo }: { meal: Meal; compact?: boolean; backTo?:string }) {
  return (
    <article className="meal-card" aria-label={meal.title}>
      <Link className="meal-card-hit" to={`/meals/${meal.id}`} state={backTo?{backTo}:undefined} aria-label={`Open ${meal.title}`} />
      <div className="meal-photo" aria-hidden="true">{monogram(meal.venue.name)}</div>
      <div className="meal-copy">
        <h3>{meal.title}</h3>
        <p className="venue-name">{meal.venue.available ? meal.venue.name : 'Restaurant information temporarily unavailable'}</p>
        <p><SewingPinIcon />{areaName(meal.areaCode)}, London</p>
        <p><CalendarIcon />{longDate(meal.startsAt.localDate)} · {meal.startsAt.localTime}</p>
        <p>{budgetRange(meal.budgetMinPence, meal.budgetMaxPence)} per person</p>
        <p><PersonIcon />Table for {meal.capacity} · {meal.confirmedCount} confirmed</p>
        <div className="avatars">
          <Link to={`/profiles/${meal.host.id}`} aria-label={`Host ${meal.host.displayName}`}>
            <Avatar name={meal.host.displayName} url={meal.host.avatarUrl} size={compact ? 29 : 32} />
          </Link>
        </div>
      </div>
      <p className="card-caption">{moodLabel(meal.mood)} · {languagesLabel(meal.languages)}</p>
    </article>
  );
}
