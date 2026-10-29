import { Navigate, useLocation, useParams } from 'react-router';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import { useQuery } from '../../api/useQuery.ts';
import type { MealDetail } from '../../api/types.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { FormMessage, Loading, Primary, PrimaryLink, TitleBar } from '../../ui/components.tsx';
import { EXIT_KEY, EditFlow, PendingExit, stepOf } from './CreatePage.tsx';
import { editBlockedReason } from './model.ts';

/**
 * Host “Edit meal” (iOS EditStepScreen): the four Create steps prefilled from the meal, saved with
 * editMeal. Only while OPEN, before the deadline and before the first approval (r07); otherwise
 * the page explains why and leads back to the guest list.
 */
export function EditMealPage() {
  const { mealId = '' } = useParams();
  const { state } = useSession();
  const { cache } = useApi();
  const location = useLocation();
  const step = stepOf(location.pathname);
  useDocumentMeta({ title: 'Edit meal · Fancy', robots: 'noindex, nofollow' });
  const signedIn = state.status === 'signed-in';
  const q = useQuery<MealDetail>(signedIn ? `meal:${mealId}:edit` : null, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const pending = cache.get<string>(EXIT_KEY);
  if (pending) return <PendingExit to={pending} />;
  if (state.status === 'guest') return <Navigate to={signInPath(location.pathname)} replace />;
  const meal = q.data?.meal;
  const blocked = meal ? editBlockedReason(meal, Date.now()) : null;
  if (meal && !blocked) return <EditFlow step={step} base={meal} />;
  return (
    <div className="scroll">
      <TitleBar title="Edit meal" back={`/meals/${mealId}/host`} />
      {blocked ? (
        <>
          <FormMessage message={blocked} />
          <div className="mt8"><PrimaryLink secondary to={`/meals/${mealId}/host`} replace>Back to your guest list</PrimaryLink></div>
        </>
      ) : q.error ? (
        <>
          <FormMessage message={errorMessage(q.error)} />
          <div className="mt8"><Primary secondary onClick={() => void q.reload()}>Try again</Primary></div>
        </>
      ) : <Loading label="Loading your meal…" />}
    </div>
  );
}
