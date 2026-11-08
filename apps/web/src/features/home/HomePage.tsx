import { Link, Navigate } from 'react-router';
import { ArrowRightIcon, CheckIcon, ExclamationTriangleIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import type { Meal } from '../../api/types.ts';
import { Notice, PrimaryLink } from '../../ui/components.tsx';
import { MealCard } from '../meals/MealCard.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { HOME_DESCRIPTION, HOME_TITLE } from '../../seo/meal-seo.ts';
import { signInPath } from '../../lib/returnTo.ts';

const STEPS = [
  ['Find a table', 'Browse meals by area, date and table size. Every table shows who’s coming and the expected cost.'],
  ['Say hello', 'Write a short introduction. The host reads it with your profile and says yes or no.'],
  ['Meet and eat', 'Chat with the table before you go. Everyone pays their own share at the restaurant.'],
] as const;

const TRUST = [
  [<PersonIcon key="p" aria-hidden="true" />, 'Small tables', '2–6 people including the host, so everyone gets to talk.'],
  [<CheckIcon key="c" aria-hidden="true" />, 'Hosts review requests', 'Nobody joins without the host saying yes.'],
  [<LockClosedIcon key="l" aria-hidden="true" />, 'No money through Fancy', 'No deposits or tickets. You pay the restaurant directly.'],
  [<ExclamationTriangleIcon key="r" aria-hidden="true" />, 'Report and block', 'Adults 18+. Reports are private and read by a person.'],
] as const;

/** Signed-out homepage (spec F3); a signed-in member opening `/` goes straight to Discover (D3). */
export function HomePage() {
  const { state } = useSession();
  useDocumentMeta({ title: HOME_TITLE, description: HOME_DESCRIPTION, canonical: '/' });
  const week = useQuery<Meal[]>(state.status === 'signed-in' ? null : 'home:week', async (c) => (await c.call('discoverMeals', { query: {} })).data.slice(0, 4));
  if (state.status === 'signed-in') return <Navigate to="/discover" replace />;

  return (
    <>
      <div className="mhead">
        <span className="wordmark">Fancy</span>
        <Link className="chip solid" to={signInPath('/discover')}>Sign in</Link>
      </div>
      <section className="hero" aria-labelledby="home-title">
        <div>
          <h1 id="home-title">Meet new people over a meal.</h1>
          <p className="lead">Small tables of 2–6 in London. Find a meal you like, say hello to the host, and pay for your own share at the restaurant.</p>
          <div className="ctas">
            <PrimaryLink to="/discover">Find a table <ArrowRightIcon aria-hidden="true" /></PrimaryLink>
            <PrimaryLink secondary to="/get-app">Get the app</PrimaryLink>
          </div>
          <p className="caption">Free to join · Adults 18+ · English-speaking tables</p>
        </div>
        <div className="art"><img src="/images/brand-table.jpg" alt="A sculptural green table with colourful chairs, laid for new friends" width="560" height="699" /></div>
      </section>

      <section className="hsec" aria-labelledby="home-week">
        <div className="sec-head">
          <div><h2 id="home-week">Tables this week</h2><p className="sec-sub">Open to new faces in central London.</p></div>
          <Link className="link" to="/discover">See all <ArrowRightIcon aria-hidden="true" /></Link>
        </div>
        {week.error && !week.data ? (
          <Notice>We couldn’t load this week’s tables. <Link className="link" to="/discover">Open Discover</Link></Notice>
        ) : !week.data ? (
          <div className="tiles" aria-busy="true" role="status"><span className="vh">Loading meals</span>
            {[0, 1, 2].map((i) => <div className="tile" key={i} aria-hidden="true"><span className="photo sk" /><div className="tc"><span className="sk" style={{ height: 14, width: '70%', marginBottom: 8 }} /><span className="sk" style={{ height: 10, width: '50%' }} /></div></div>)}
          </div>
        ) : week.data.length === 0 ? (
          <Notice>This week’s tables are all full. New meals are added every week — or host your own.</Notice>
        ) : (
          <div className="tiles">{week.data.map((m) => <MealCard key={m.id} meal={m} variant="tile" />)}</div>
        )}
      </section>

      <section className="hsec" aria-labelledby="home-how">
        <h2 id="home-how">How it works</h2>
        <p className="sec-sub">No swiping, no tickets — just a table and a few new people.</p>
        <ol className="steps">
          {STEPS.map(([t, d], i) => <li className="stepc" key={t}><span className="n" aria-hidden="true">{i + 1}</span><div><b>{t}</b><span>{d}</span></div></li>)}
        </ol>
      </section>

      <section className="hsec" aria-labelledby="home-trust">
        <h2 id="home-trust">Made for comfortable first meals</h2>
        <p className="sec-sub">Small, reviewed and friendship-first.</p>
        <ul className="trust">
          {TRUST.map(([icon, t, d]) => <li key={t}><b>{icon}{t}</b><span>{d}</span></li>)}
        </ul>
      </section>

      <section className="hsec" aria-labelledby="home-host">
        <div className="appband">
          <div>
            <h2 id="home-host">Host your own table</h2>
            <p>Pick any restaurant in London, set the time and table size, and choose who joins. You book the restaurant yourself; everyone pays their own share.</p>
            <Link className="btn" to={signInPath('/create')}>Host a meal</Link>
          </div>
        </div>
      </section>
      <div style={{ height: 24 }} />
    </>
  );
}
