import { Link, useSearchParams } from 'react-router';
import { MY_MEAL_SECTIONS } from '@fancy/contracts';
import { ArrowRightIcon, CalendarIcon, PlusIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { MyMealItem, MyMealSection } from '../../api/types.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { LinkRow, PageHeader, Pill, Primary, PrimaryLink, SkeletonCards, StateBlock } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { MealCard } from './MealCard.tsx';
import { applicationLabels, bookingLabel } from './present.ts';

const LABELS: Record<MyMealSection, string> = { UPCOMING: 'Upcoming', APPLICATIONS: 'Applications', HOSTING: 'Hosting', PAST: 'Past', CANCELLED: 'Cancelled' };

/** Per-row status line (iOS rowStatus): application progress for applicants, host-reported booking for seat holders. */
export function rowStatus(item: MyMealItem, section: MyMealSection): string {
  if (item.meal.status === 'CANCELLED') return 'Meal cancelled';
  if (item.application?.state === 'CANCELLED') return applicationLabels.CANCELLED;
  if (section === 'PAST') return item.role === 'HOST' ? 'Completed · You hosted' : 'Completed';
  if (item.role === 'HOST') return `You’re hosting · ${bookingLabel(item.meal)}`;
  if (item.role === 'GUEST') return `Seat confirmed · ${bookingLabel(item.meal)}`;
  return item.application ? applicationLabels[item.application.state] : 'Open table';
}

const header = <PageHeader size="tab" title="Your next good meal." subtitle="Good plans, all in one place." />;

/** The five private Meals sections (iOS MyMealsScreen, API §6); the chosen section lives in the URL. */
export function MyMealsPage() {
  const { state } = useSession();
  const [params, setParams] = useSearchParams();
  const raw = params.get('section');
  const section: MyMealSection = (MY_MEAL_SECTIONS as readonly string[]).includes(raw ?? '') ? (raw as MyMealSection) : 'UPCOMING';
  useDocumentMeta({ title: 'My meals · Fancy', robots: 'noindex, nofollow' });
  const q = useQuery<MyMealItem[]>(state.status === 'signed-in' ? `myMeals:${section}` : null, async (c) => {
    const rows: MyMealItem[] = [];
    let cursor: string | null = null;
    for (let n = 0; n < 10; n++) {
      const res: { data: MyMealItem[]; page: { nextCursor: string | null } } = await c.call('myMeals', { query: { section, limit: 50, ...(cursor ? { cursor } : {}) } });
      rows.push(...res.data);
      cursor = res.page.nextCursor;
      if (!cursor) break;
    }
    return rows;
  });

  if (state.status !== 'signed-in') {
    return (
      <div className="scroll">
        {header}
        {state.status === 'guest' && (
          <StateBlock icon={<CalendarIcon width={30} height={30} aria-hidden="true" />} title="A good meal is waiting." action={<PrimaryLink to={signInPath('/meals')}>Sign in</PrimaryLink>}>
            Sign in to see the tables you’re hosting and joining.
          </StateBlock>
        )}
      </div>
    );
  }
  // A confirmed seat lives in Upcoming; Applications lists requests still in progress or closed without a seat.
  const rows = section === 'APPLICATIONS' ? (q.data ?? []).filter((i) => i.application?.state !== 'CONFIRMED') : (q.data ?? []);
  const hosting = section === 'HOSTING';
  return (
    <div className="scroll">
      {header}
      <div className="segtabs" role="tablist" aria-label="Meal categories">
        {MY_MEAL_SECTIONS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} onClick={() => setParams(s === 'UPCOMING' ? {} : { section: s }, { replace: true })}>{LABELS[s]}</button>
        ))}
      </div>
      <div role="tabpanel" aria-label={LABELS[section]}>
        {q.error && !q.data ? (
          <StateBlock title="We couldn’t load your meals." action={<Primary onClick={() => void q.reload()}>Try again</Primary>}>{errorMessage(q.error)}</StateBlock>
        ) : !q.data ? <SkeletonCards count={2} /> : rows.length === 0 ? (
          <StateBlock icon={<CalendarIcon width={30} height={30} aria-hidden="true" />}
            title={hosting ? 'Your table starts with you.' : section === 'CANCELLED' ? 'Nothing cancelled.' : 'A good meal is waiting.'}
            action={section === 'CANCELLED' ? null : <PrimaryLink to={hosting ? '/create' : '/discover'}>{hosting ? 'Create a meal' : 'Explore meals'} <ArrowRightIcon aria-hidden="true" /></PrimaryLink>}>
            {section === 'APPLICATIONS' ? 'Your requests will appear here.' : section === 'PAST' ? 'Meals you’ve shared will appear here.' : section === 'CANCELLED' ? 'Cancelled meals will appear here.' : hosting ? 'Host a meal and choose who joins your table.' : 'Find a table that fits your evening.'}
          </StateBlock>
        ) : (
          <div className="cards grid2">
            {rows.map((item) => {
              const past = section === 'PAST';
              const canManage = item.role === 'HOST' && item.meal.status === 'OPEN' && !past;
              const feedback = past && item.meal.allowedActions.includes('POST_MEAL');
              return (
                <div className="list-card" key={`${item.meal.id}:${item.application?.id ?? item.role}`}>
                  <MealCard meal={item.meal} variant="compact" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10, minHeight: 28 }}>
                    <Pill>{rowStatus(item, section)}</Pill>
                    {canManage && <Link className="link" to={`/meals/${item.meal.id}/host`}>Manage</Link>}
                  </div>
                  {feedback && <PrimaryLink secondary to={`/post-meal/${item.meal.id}`} className="small">Leave feedback</PrimaryLink>}
                  {item.conversationId && section !== 'APPLICATIONS' && <Link className="link" to={`/chat/${item.conversationId}`}>Open group chat</Link>}
                  {item.application && item.role !== 'HOST' && section === 'APPLICATIONS' && <Link className="link" to={`/meals/${item.meal.id}/status`}>View your request</Link>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ marginTop: 20 }}>
        <LinkRow first icon={<PlusIcon width={14} height={14} />} label="Host a meal" sub="Choose a restaurant, set a time and review requests" to="/create" />
      </div>
    </div>
  );
}
