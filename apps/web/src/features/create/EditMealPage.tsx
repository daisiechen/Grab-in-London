import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, type RequestOf } from '@fancy/client';
import { CheckIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import type { MealDetail } from '../../api/types.ts';
import { FormError, Loading, Notice, PageHeader, Primary } from '../../ui/components.tsx';
import { useToast } from '../../ui/toast.tsx';
import { ArrangeStep, CostsStep, IntroduceStep } from './steps.tsx';
import { draftFromMeal, poundsToPence, timeInput, validateStep, type MealDraft } from './model.ts';

type EditBody = RequestOf<'editMeal'>['body'];

/** Only fields that differ from the loaded meal are sent (PATCH + If-Match on Meal.version). */
export function editPatch(before: MealDraft, after: MealDraft): EditBody | null {
  const patch: EditBody = {};
  if (after.title.trim() !== before.title) patch.title = after.title.trim();
  if (after.description.trim() !== before.description) patch.description = after.description.trim();
  if (after.capacity !== before.capacity) patch.capacity = after.capacity;
  if (after.minimum !== before.minimum) patch.minimum = after.minimum;
  if (after.mood && after.mood !== before.mood) patch.mood = after.mood;
  if (after.languages.join() !== before.languages.join()) patch.languages = after.languages;
  if (after.cuisineCode !== before.cuisineCode) patch.cuisineCode = after.cuisineCode;
  if (after.dietaryCodes.join() !== before.dietaryCodes.join()) patch.dietaryCodes = after.dietaryCodes.length ? after.dietaryCodes : null;
  const min = poundsToPence(after.budgetMin);
  const max = poundsToPence(after.budgetMax);
  if (min !== null && after.budgetMin !== before.budgetMin) patch.budgetMinPence = min;
  if (max !== null && after.budgetMax !== before.budgetMax) patch.budgetMaxPence = max;
  if (after.date !== before.date || after.time !== before.time || after.startOffset !== before.startOffset) patch.start = timeInput(after.date, after.time, after.startOffset);
  if (after.closeDate !== before.closeDate || after.closeTime !== before.closeTime || after.closeOffset !== before.closeOffset) patch.close = timeInput(after.closeDate, after.closeTime, after.closeOffset);
  return Object.keys(patch).length ? patch : null;
}

/**
 * Host edit before the first approval (T07). Once the server reports arrangementLocked (or a
 * 409 ARRANGEMENT_LOCKED), the form becomes read-only; the lock is permanent.
 */
export function EditMealPage() {
  const { mealId = '' } = useParams();
  const { api, cache } = useApi();
  const navigate = useNavigate();
  const notify = useToast();
  const q = useQuery<MealDetail>(`meal:${mealId}:edit`, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [before, setBefore] = useState<MealDraft | null>(null);
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);

  useEffect(() => {
    if (!q.data) return;
    const loaded = draftFromMeal(q.data.meal);
    setBefore(loaded);
    setDraft((d) => d ?? loaded);
  }, [q.data]);

  if (!q.data || !draft || !before) return q.error ? <div className="body-pad"><FormError>{errorMessage(q.error)}</FormError></div> : <Loading />;
  const meal = q.data.meal;
  const locked = meal.arrangementLocked || !meal.allowedActions.includes('EDIT');
  const update = (patch: Partial<MealDraft>) => { setDraft({ ...draft, ...patch }); setError(''); };

  const save = async () => {
    for (const s of [0, 1] as const) {
      const issue = validateStep(draft, s);
      if (issue) { setError(issue); return; }
    }
    const min = poundsToPence(draft.budgetMin);
    const max = poundsToPence(draft.budgetMax);
    if (min === null || max === null || min <= 0 || max < min) { setError('Enter a valid budget per person.'); return; }
    const body = editPatch(before, draft);
    if (!body) { navigate(`/meals/${mealId}`); return; }
    setBusy(true);
    try {
      await intent.run({ body, v: meal.version }, (key) => api.client.call('editMeal', { params: { mealId }, body, ifMatch: meal.version, idempotencyKey: key }));
      cache.delete(`meal:${mealId}`);
      notify('Meal updated.');
      navigate(`/meals/${mealId}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'VERSION_CONFLICT' || e.code === 'ARRANGEMENT_LOCKED')) await q.reload();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Edit arrangements" backTo={`/meals/${mealId}`} />
      <div className="body-pad create-flow">
        {locked ? (
          <Notice role="status">A guest has been approved, so the arrangements can no longer be changed. You can still cancel the meal or update your booking status.</Notice>
        ) : (
          <>
            <ArrangeStep draft={draft} update={update} lockedVenue />
            <IntroduceStep draft={draft} update={update} />
            <CostsStep draft={draft} update={update} showBooking={false} />
            <FormError>{error}</FormError>
            <Primary disabled={busy} onClick={() => void save()}>Save changes <CheckIcon /></Primary>
          </>
        )}
        {locked && <FormError>{error}</FormError>}
      </div>
    </>
  );
}
