import { useEffect, useRef, useState } from 'react';
import {
  FeedbackRunner, planFeedback, receiptReconciler, scopeKey, withRetry, REVIEW_MAX,
  type FeedbackDraft, type FeedbackItem, type FeedbackPlan, type FeedbackScope, type FeedbackSnapshot, type ItemStatus,
} from '@fancy/client';
import { CheckIcon, HeartIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { Field, FormError, Notice, Primary } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';

export const STATUS_LABEL: Record<ItemStatus, string> = {
  idle: '', skipped: 'Skipped · no changes', saving: 'Saving…', saved: 'Saved', notSavedYet: 'Not saved yet',
  failed: 'Couldn’t be saved', unknown: 'Status unknown', conflict: 'Version conflict',
};
const ITEM_LABEL: Record<FeedbackItem, string> = { review: 'Public reference', reconnect: 'Reconnect choice' };

const FAILURE: Record<string, string> = {
  FORBIDDEN: 'This isn’t available to you any more. The feedback window may have closed.',
  STATE_CONFLICT: 'This couldn’t be saved in the current state of the meal.',
  NOT_FOUND: 'This member or meal is no longer available.',
};

interface Memory { accountId: string; runner: FeedbackRunner; drafts: Map<string, FeedbackDraft>; listeners: Set<(key: string) => void> }
let memory: Memory | null = null;

/**
 * Per-account, in-memory only: leaving and returning restores the same scope's draft and its
 * unresolved intent; a different account replaces everything (no receipt/draft copy carried over).
 */
function useMemory(accountId: string): Memory {
  const { api } = useApi();
  if (!memory || memory.accountId !== accountId) {
    const listeners = new Set<(key: string) => void>();
    const runner = new FeedbackRunner(
      async (scope, step, key) => {
        const params = { mealId: scope.mealId, subjectId: scope.subjectId };
        const call = (): Promise<unknown> => {
          switch (step.operation) {
            case 'reviewPerson': return api.client.call('reviewPerson', { params, body: { body: step.body }, ifMatch: step.ifMatch, idempotencyKey: key });
            case 'selectReconnect': return api.client.call('selectReconnect', { params, body: { selected: step.selected }, ifMatch: step.ifMatch, idempotencyKey: key });
            case 'revokeConnection': return api.client.call('revokeConnection', { params: { subjectId: scope.subjectId }, ifMatch: step.ifMatch, idempotencyKey: key });
          }
        };
        // Transient failures replay the same key; exhausted retries surface as Status unknown.
        return withRetry(call, api.retry);
      },
      (key) => { for (const l of listeners) l(key); },
      receiptReconciler(api.client),
    );
    memory = { accountId, runner, drafts: new Map(), listeners };
  }
  return memory;
}

/** Sign-out / account switch hook for tests and session teardown. */
export function resetFeedbackMemory() { memory = null; }

interface Props {
  scope: FeedbackScope;
  snapshot: FeedbackSnapshot;
  subjectName: string;
  /** Reload the authoritative post-meal state (after a run, or on version conflict). */
  reload: () => Promise<unknown>;
  visibilityNote: string | null;
}

/**
 * One `Save feedback` for the public reference and the private reconnect choice (PATCH-004,
 * Figma 136:7997 / 401 / 404 / 407 / 410 / 567). Drafts are kept per scope so switching member
 * neither submits nor loses another member's draft; late results update only their own scope.
 */
export function FeedbackSection({ scope, snapshot, subjectName, reload, visibilityNote }: Props) {
  const key = scopeKey(scope);
  const currentKey = useRef(key);
  currentKey.current = key;
  const [, rerender] = useState(0);
  const mem = useMemory(scope.accountId);
  const { runner } = mem;
  const drafts = useRef(mem.drafts);
  drafts.current = mem.drafts;
  useEffect(() => {
    const listener = (changed: string) => { if (changed === currentKey.current) rerender((n) => n + 1); };
    mem.listeners.add(listener);
    return () => { mem.listeners.delete(listener); };
  }, [mem]);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<Extract<FeedbackPlan, { kind: 'save' }> | null>(null);

  const draft = drafts.current.get(key) ?? { review: snapshot.review?.body ?? '', selected: snapshot.reconnect.selected };
  const setDraft = (next: Partial<FeedbackDraft>) => { drafts.current.set(key, { ...draft, ...next }); setMessage(''); rerender((n) => n + 1); };
  const run = runner.state(scope);
  const unresolved = runner.unresolved(scope);

  const finish = async (target: FeedbackScope) => {
    const s = runner.state(target);
    // Refresh the authoritative snapshot; on conflict this loads the latest version while the
    // local draft stays for comparison (never silently overwritten).
    await reload().catch(() => undefined);
    if (scopeKey(target) !== currentKey.current) return;
    if (s.statuses.review === 'saved' || s.statuses.reconnect === 'saved') {
      const saved = drafts.current.get(scopeKey(target));
      if (saved && s.statuses.review !== 'conflict' && s.statuses.reconnect !== 'conflict' && !Object.values(s.pending).some(Boolean)) drafts.current.delete(scopeKey(target));
    }
    rerender((n) => n + 1);
  };

  const save = async () => {
    setMessage('');
    const target = scope;
    if (unresolved) { await runner.resume(target); await finish(target); return; }
    const plan = planFeedback(snapshot, draft);
    if (plan.kind === 'noChanges') { setMessage('No changes to save.'); return; }
    if (plan.kind === 'invalid') {
      setMessage(plan.reason === 'emptyOverwrite' ? 'A saved reference can’t be cleared here. Edit the text or keep your current reference.'
        : plan.reason === 'tooLong' ? `Use up to ${REVIEW_MAX} characters.` : 'The 7-day feedback window has closed, so this choice can’t be changed.');
      return;
    }
    if (plan.confirmRevoke) { setConfirm(plan); return; }
    await runner.save(target, plan);
    await finish(target);
  };

  const confirmRevoke = async () => {
    const plan = confirm;
    const target = scope;
    setConfirm(null);
    if (!plan) return;
    await runner.save(target, plan);
    await finish(target);
  };

  const shown = (['review', 'reconnect'] as const).filter((i) => run.statuses[i] !== 'idle');
  const partial = run.statuses.review === 'saved' && run.statuses.reconnect !== 'saved' && run.statuses.reconnect !== 'skipped' && run.statuses.reconnect !== 'idle';
  const failureText = run.errorCode ? FAILURE[run.errorCode] : undefined;

  return (
    <section aria-label={`Feedback for ${subjectName}`}>
      {snapshot.windowOpen ? (
        <Field label={snapshot.review ? 'Your public reference' : 'A public reference · optional'}
          hint={`Describe the shared experience, rather than rating a person. ${draft.review.length}/${REVIEW_MAX}`}>
          {(p) => <textarea {...p} rows={4} maxLength={REVIEW_MAX} placeholder="What was it like sharing a table?" value={draft.review}
            disabled={run.running} onChange={(e) => setDraft({ review: e.target.value })} />}
        </Field>
      ) : <Notice>The 7-day window for references and new reconnect choices has closed.</Notice>}
      {visibilityNote && <div className="summary-box"><strong>Your reference</strong><p>{visibilityNote}</p></div>}
      {(snapshot.windowOpen || snapshot.reconnect.connection === 'OPEN') && (
        <label className="check-row reconnect">
          <input type="checkbox" checked={draft.selected} disabled={run.running || (!snapshot.windowOpen && !snapshot.reconnect.selected)}
            onChange={(e) => setDraft({ selected: e.target.checked })} />
          <span><strong>I’d like to share a table again</strong><small>Private unless you both choose this.</small></span>
          <HeartIcon />
        </label>
      )}
      <Primary secondary disabled={run.running} aria-busy={run.running || undefined} onClick={() => void save()}>
        {run.running ? 'Saving…' : unresolved ? 'Check status and continue' : 'Save feedback'} <CheckIcon />
      </Primary>
      {shown.length > 0 && (
        <ul className="feedback-results" aria-label="Save results" aria-live="polite">
          {shown.map((i) => <li key={i} data-status={run.statuses[i]}><strong>{ITEM_LABEL[i]}</strong>: {STATUS_LABEL[run.statuses[i]]}</li>)}
        </ul>
      )}
      {partial && <p className="muted" role="status">Public reference saved. Your reconnect choice isn’t saved yet.</p>}
      {(run.statuses.review === 'unknown' || run.statuses.reconnect === 'unknown') && (
        <Notice role="status">We couldn’t confirm whether this saved. Check status before changing anything; your original request is kept.</Notice>
      )}
      {(run.statuses.review === 'conflict' || run.statuses.reconnect === 'conflict') && (
        <Notice role="alert">This changed elsewhere. The latest version is loaded and your draft is kept. Review it and save again.</Notice>
      )}
      {(run.statuses.review === 'failed' || run.statuses.reconnect === 'failed') && <FormError>{failureText ?? 'This couldn’t be saved. Your draft is kept.'}</FormError>}
      <FormError>{message && message !== 'No changes to save.' ? message : ''}</FormError>
      {message === 'No changes to save.' && <p className="muted" role="status">{message}</p>}
      <ConfirmSheet open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }} title="Withdraw your connection?"
        keepLabel="Keep connection" confirmLabel="Withdraw connection" onConfirm={() => void confirmRevoke()}>
        <p>Private messages will stop. Your earlier messages remain available. You will both need to choose again to reconnect.</p>
      </ConfirmSheet>
    </section>
  );
}
