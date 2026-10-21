import { useSearchParams } from 'react-router';
import { MY_MEAL_SECTIONS } from '@fancy/contracts';
import { ArrowRightIcon, CalendarIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { MyMealItem, MyMealSection } from '../../api/types.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormError, Loading, Primary, PrimaryLink } from '../../ui/components.tsx';
import { MealCard } from './MealCard.tsx';
import { applicationLabels } from './present.ts';

const TAB_LABELS: Record<MyMealSection, string> = {
  UPCOMING: 'Upcoming', APPLICATIONS: 'Applications', HOSTING: 'Hosting', PAST: 'Past', CANCELLED: 'Cancelled',
};

const statusOf = (item: MyMealItem) => {
  if (item.role === 'HOST') return item.meal.status === 'CANCELLED' ? 'You cancelled this meal' : 'You’re hosting';
  if (item.meal.status === 'CANCELLED') return 'Meal cancelled';
  return item.application ? applicationLabels[item.application.state] : 'Open table';
};

/**
 * The five private Meals sections (API §6). Sections may intentionally overlap; each
 * application round is keyed by its own id. Not a public itinerary.
 */
export function MyMealsPage() {
  const { state } = useSession();
  const [params, setParams] = useSearchParams();
  const raw = params.get('section');
  const section: MyMealSection = (MY_MEAL_SECTIONS as readonly string[]).includes(raw ?? '') ? (raw as MyMealSection) : 'UPCOMING';
  const signedIn = state.status === 'signed-in';
  const q = useQuery<MyMealItem[]>(signedIn ? `myMeals:${section}` : null, async (c) => (await c.call('myMeals', { query: { section } })).data);

  return (
    <div className="body-pad">
      <div className="eyebrow">GOOD PLANS, ALL IN ONE PLACE</div>
      <h1>Your next good meal.</h1>
      {state.status === 'guest' ? (
        <div className="empty">
          <CalendarIcon />
          <h2>A good meal is waiting.</h2>
          <p>Sign in to see the meals you’ve joined, requested and hosted.</p>
          <PrimaryLink to={signInPath('/meals')}>Sign in <ArrowRightIcon /></PrimaryLink>
        </div>
      ) : (
        <>
          <div className="tabs" role="group" aria-label="Meal categories">
            {MY_MEAL_SECTIONS.map((s) => (
              <button type="button" key={s} className={s === section ? 'selected' : ''} aria-pressed={s === section}
                onClick={() => setParams({ section: s }, { replace: true })}>{TAB_LABELS[s]}</button>
            ))}
          </div>
          {q.error && !q.data ? (
            <><FormError>{errorMessage(q.error)}</FormError><Primary secondary onClick={() => void q.reload()}>Try again</Primary></>
          ) : !q.data ? <Loading /> : q.data.length ? (
            q.data.map((item) => (
              <div className="list-meal" key={item.application?.id ?? `${item.role}:${item.meal.id}`}>
                <MealCard meal={item.meal} compact />
                <div className="list-foot"><span className="status-tag">{statusOf(item)}</span></div>
              </div>
            ))
          ) : (
            <div className="empty">
              <CalendarIcon />
              <h2>{section === 'HOSTING' ? 'Your table starts with you.' : 'A good meal is waiting.'}</h2>
              <p>{section === 'APPLICATIONS' ? 'Your requests will appear here.' : 'Find a table that fits your evening.'}</p>
              <PrimaryLink to={section === 'HOSTING' ? '/create' : '/discover'}>
                {section === 'HOSTING' ? 'Create a meal' : 'Explore meals'} <ArrowRightIcon />
              </PrimaryLink>
            </div>
          )}
        </>
      )}
    </div>
  );
}
