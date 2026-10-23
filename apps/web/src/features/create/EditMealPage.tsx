import { onPrivateStateClear } from '../../lib/drafts.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, IntentTracker, IntentUnresolvedError, newIntentKey, type RequestOf } from '@fancy/client';
import { CheckIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
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
  return <MealEditor key={mealId} mealId={mealId} />;
}
function MealEditor({ mealId }: { mealId: string }) {
  const { api, cache } = useApi();
  const navigate = useNavigate();
  const notify = useToast();
  const q = useQuery<MealDetail>(`meal:${mealId}:edit`, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [before, setBefore] = useState<MealDraft | null>(null);
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tracker = useMemo(() => new IntentTracker(newIntentKey), []);
  const original = useRef<{body: EditBody; version: string} | null>(null);
  const [unknown, setUnknown] = useState(false);
  useEffect(() => {
    const reset = () => { tracker.reset(); original.current = null; };
    const unsubscribe = onPrivateStateClear(reset);
    return () => { unsubscribe(); reset(); };
  }, [tracker]);

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
    if (!body) { navigate(`/meals/${mealId}`,{state:{backTo:'/meals?section=HOSTING'}}); return; }
    await submit(body, meal.version);
  };

  const saved = () => {
    setUnknown(false);
    cache.delete(`meal:${mealId}`);
    cache.delete(`meal:${mealId}:edit`);
    notify('Meal updated.');
    navigate(`/meals/${mealId}`, { replace: true, state: {backTo:'/meals?section=HOSTING'} });
  };
  const submit = async (body: EditBody, version: string) => {
    const generation = tracker.generation;
    setBusy(true); setError('');
    try {
      original.current = {body, version};
      await tracker.run({body, version}, key => api.client.call('editMeal', {params:{mealId}, body, ifMatch:version, idempotencyKey:key}));
      if (generation !== tracker.generation) return;
      saved();
    } catch (e) {
      if (generation !== tracker.generation) return;
      if (e instanceof IntentUnresolvedError) { setError('Your earlier edit hasn’t been confirmed yet. Check its status before saving changes.'); return; }
      setUnknown(tracker.pending !== null);
      if (tracker.pending) { setError('Status unknown: your changes are kept. Check status before saving again.'); return; }
      if (e instanceof ApiError && (e.code === 'VERSION_CONFLICT' || e.code === 'ARRANGEMENT_LOCKED')) {
        await q.reload();
        if (generation !== tracker.generation) return;
      }
      setError(errorMessage(e));
    } finally { if (generation === tracker.generation) setBusy(false); }
  };
  const checkStatus = async () => {
    const generation = tracker.generation;
    setBusy(true); setError('');
    try {
      const outcome = await tracker.reconcile(api.client, 'editMeal');
      if (generation !== tracker.generation) return;
      if (outcome === 'saved') { saved(); return; }
      if (outcome === 'resend' && original.current) { await submit(original.current.body, original.current.version); return; }
      if (outcome === 'conflict' || outcome === 'expired' || outcome === 'rejected') {
        setUnknown(false);
        await q.reload();
        if (generation !== tracker.generation) return;
        setError('That edit wasn’t accepted. The latest arrangements are loaded and your changes are kept. Review before saving again.'); return;
      }
      setError('Still no confirmed result. Your changes are kept; check again shortly.');
    } catch (e) { if (generation === tracker.generation) setError(errorMessage(e)); }
    finally { if (generation === tracker.generation) setBusy(false); }
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
            <Primary disabled={busy || unknown} onClick={() => void save()}>Save changes <CheckIcon /></Primary>
          </>
        )}
        {unknown && <Primary secondary disabled={busy} onClick={() => void checkStatus()}>Check status</Primary>}
        {locked && <FormError>{error}</FormError>}
      </div>
    </>
  );
}
