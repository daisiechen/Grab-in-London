import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  FeedbackRunner, planFeedback, receiptReconciler, scopeKey, REVIEW_MAX,
  type ApiClient, type FeedbackDraft, type FeedbackItem, type FeedbackPlan, type FeedbackScope, type FeedbackSnapshot, type ItemStatus,
} from '@fancy/client';
import { Primary } from '../../ui/Button.tsx';
import { CheckRow } from '../../ui/CheckRow.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { useServices } from '../../services.tsx';

export const STATUS_LABEL: Record<ItemStatus, string> = {
  idle: '', skipped: 'Skipped · no changes', saving: 'Saving…', saved: 'Saved', notSavedYet: 'Not saved yet',
  failed: 'Couldn’t be saved', unknown: 'Status unknown', conflict: 'Version conflict',
};
const ITEM_LABEL: Record<FeedbackItem, string> = { review: 'Public reference', reconnect: 'Reconnect choice' };

interface Memory { accountId: string; runner: FeedbackRunner; drafts: Map<string, FeedbackDraft>; listeners: Set<(key: string) => void>; alive: boolean }
let memory: Memory | null = null;

/** Kills the old account's runner (generation fence), drafts and listeners; nothing can write back. */
function discard(old: Memory | null) {
  if (!old) return;
  old.alive = false;
  old.runner.clear();
  old.drafts.clear();
  old.listeners.clear();
}

/** In-memory per account only; a different account replaces everything (PATCH-004 isolation). */
function memoryFor(accountId: string, api: ApiClient): Memory {
  if (!memory || memory.accountId !== accountId) {
    discard(memory);
    const box = { alive: true };
    const listeners = new Set<(key: string) => void>();
    const runner = new FeedbackRunner(
      async (scope, step, key): Promise<unknown> => {
        if (!box.alive) throw new Error('FEEDBACK_MEMORY_CLEARED');
        const params = { mealId: scope.mealId, subjectId: scope.subjectId };
        switch (step.operation) {
          case 'reviewPerson': return api.call('reviewPerson', { params, body: { body: step.body }, ifMatch: step.ifMatch, idempotencyKey: key });
          case 'selectReconnect': return api.call('selectReconnect', { params, body: { selected: step.selected }, ifMatch: step.ifMatch, idempotencyKey: key });
          case 'revokeConnection': return api.call('revokeConnection', { params: { subjectId: scope.subjectId }, ifMatch: step.ifMatch, idempotencyKey: key });
        }
      },
      (key) => { for (const l of listeners) l(key); },
      receiptReconciler(api),
    );
    memory = { accountId, runner, drafts: new Map(), listeners, get alive() { return box.alive; }, set alive(v: boolean) { box.alive = v; } };
  }
  return memory;
}

/** Session end (sign-out, 401, account switch, deletion) via services.onSessionEnd, and tests. */
export function resetFeedbackMemory() { discard(memory); memory = null; }

interface Props {
  api: ApiClient;
  scope: FeedbackScope;
  snapshot: FeedbackSnapshot;
  name: string;
  /** References and new choices need present attendance; withdrawing an OPEN connection never does. */
  canWriteFeedback: boolean;
  reload: () => Promise<unknown>;
}

/** One `Save feedback` per tablemate (iOS 136:7392, 401/404/407/410/423/567). */
export function FeedbackBlock({ api, scope, snapshot, name, canWriteFeedback, reload }: Props) {
  const key = scopeKey(scope);
  const currentKey = useRef(key);
  currentKey.current = key;
  const { onSessionEnd } = useServices();
  // Session end (sign-out, 401, account switch, deletion) must kill pending intents and drafts.
  useEffect(() => { onSessionEnd.add(resetFeedbackMemory); }, [onSessionEnd]);
  const mem = memoryFor(scope.accountId, api);
  const [, rerender] = useState(0);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [confirm, setConfirm] = useState<Extract<FeedbackPlan, { kind: 'save' }> | null>(null);
  useEffect(() => {
    const listener = (changed: string) => { if (changed === currentKey.current) rerender((n) => n + 1); };
    mem.listeners.add(listener);
    return () => { mem.listeners.delete(listener); };
  }, [mem]);

  const draft = mem.drafts.get(key) ?? { review: snapshot.review?.body ?? '', selected: snapshot.reconnect.selected };
  const setDraft = (next: Partial<FeedbackDraft>) => { mem.drafts.set(key, { ...draft, ...next }); setMessage(null); rerender((n) => n + 1); };
  const run = mem.runner.state(scope);
  const unresolved = mem.runner.unresolved(scope);
  const editable = canWriteFeedback && snapshot.windowOpen;

  const finish = async (target: FeedbackScope) => {
    await reload().catch(() => undefined);
    const s = mem.runner.state(target);
    if (!Object.values(s.pending).some(Boolean) && s.statuses.review !== 'conflict' && s.statuses.reconnect !== 'conflict' &&
      (s.statuses.review === 'saved' || s.statuses.reconnect === 'saved')) mem.drafts.delete(scopeKey(target));
    if (scopeKey(target) === currentKey.current) rerender((n) => n + 1);
  };

  const save = async () => {
    setMessage(null);
    const target = scope;
    if (unresolved) { await mem.runner.resume(target); await finish(target); return; }
    const plan = planFeedback(snapshot, editable ? draft : { review: snapshot.review?.body ?? '', selected: draft.selected });
    if (plan.kind === 'noChanges') { setMessage({ text: 'No changes to save.', tone: 'info' }); return; }
    if (plan.kind === 'invalid') {
      setMessage({ tone: 'error', text: plan.reason === 'emptyOverwrite' ? 'A saved reference can’t be cleared here. Edit the text or keep your current reference.'
        : plan.reason === 'tooLong' ? `Use up to ${REVIEW_MAX} characters.` : 'The 7-day feedback window has closed, so this choice can’t be changed.' });
      return;
    }
    if (plan.confirmRevoke) { setConfirm(plan); return; }
    await mem.runner.save(target, plan);
    await finish(target);
  };

  const shown = (['review', 'reconnect'] as const).filter((i) => run.statuses[i] !== 'idle');
  const anyUnknown = run.statuses.review === 'unknown' || run.statuses.reconnect === 'unknown';
  const anyConflict = run.statuses.review === 'conflict' || run.statuses.reconnect === 'conflict';
  const anyFailed = run.statuses.review === 'failed' || run.statuses.reconnect === 'failed';
  const partial = run.statuses.review === 'saved' && ['notSavedYet', 'failed', 'unknown', 'conflict'].includes(run.statuses.reconnect);

  return (
    <View style={{ gap: 6 }} testID={`feedback:${scope.subjectId}`}>
      {editable ? (
        <Field label={`Reference for ${name}`} value={draft.review} onChangeText={(v) => setDraft({ review: v })} maxLength={REVIEW_MAX} multiline
          hint={`Describe the shared experience. ${draft.review.length}/${REVIEW_MAX}`} />
      ) : null}
      {editable || snapshot.reconnect.connection === 'OPEN' ? (
        <CheckRow label={`I’d meet ${name} again`} checked={draft.selected} onChange={(next) => { if (!run.running) setDraft({ selected: next }); }} />
      ) : null}
      <Body muted>{snapshot.reconnect.connection === 'OPEN' ? 'Connected' : snapshot.reconnect.selected ? 'You chose to meet again · private until mutual' : 'Not chosen'}</Body>
      <Primary secondary label={run.running ? 'Saving…' : unresolved ? `Check status for ${name}` : `Save feedback for ${name}`} disabled={run.running} onPress={() => void save()} />
      {shown.map((i) => <Body key={i}>{`${ITEM_LABEL[i]}: ${STATUS_LABEL[run.statuses[i]]}`}</Body>)}
      {partial ? <FormMessage tone="info" message="Public reference saved. Your reconnect choice isn’t saved yet." /> : null}
      {anyUnknown ? <FormMessage tone="info" message="We couldn’t confirm whether this saved. Check status before changing anything; your original request is kept." /> : null}
      {anyConflict ? <FormMessage message="This changed elsewhere. The latest version is loaded and your draft is kept. Review it and save again." /> : null}
      {anyFailed ? <FormMessage message="This couldn’t be saved. Your draft is kept." /> : null}
      <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />
      <Sheet visible={confirm !== null} title="Withdraw your connection?" onClose={() => setConfirm(null)}>
        <Body>Private messages will stop. Your earlier messages remain available. You will both need to choose again to reconnect.</Body>
        <Primary secondary label="Keep connection" onPress={() => setConfirm(null)} />
        <Primary label="Withdraw connection" onPress={() => { const plan = confirm; const target = scope; setConfirm(null); if (plan) void mem.runner.save(target, plan).then(() => finish(target)); }} />
      </Sheet>
    </View>
  );
}
