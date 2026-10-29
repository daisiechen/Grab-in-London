import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { Avatar, FormMessage, Primary, TextAction, TitleBar } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';

type Blocked = ResponseOf<'listBlocks'>['data'][number];

/** Own blocked members (iOS BlockedMembersScreen): open a profile, or unblock with confirmation. */
export function BlockedMembersPage() {
  const { state } = useSession();
  const { api } = useApi();
  useDocumentMeta({ title: 'Blocked members · Fancy', robots: 'noindex, nofollow' });
  const signedIn = state.status === 'signed-in';
  const q = useQuery<Blocked[]>(signedIn ? `blocks:${state.session.user.id}` : null, async (c) => {
    const rows: Blocked[] = [];
    let cursor: string | null = null;
    for (let n = 0; n < 20; n++) {
      const res: { data: Blocked[]; page: { nextCursor: string | null } } = await c.call('listBlocks', { query: { limit: 50, ...(cursor ? { cursor } : {}) } });
      rows.push(...res.data);
      cursor = res.page.nextCursor;
      if (!cursor) break;
    }
    return rows;
  });
  const [confirm, setConfirm] = useState<Blocked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  if (state.status === 'guest') return <Navigate to={signInPath('/blocked-members')} replace />;

  const unblock = async (m: Blocked) => {
    setBusy(true);
    setError(null);
    try {
      await intent.run({ id: m.profile.id, v: m.version }, (key) => api.client.call('unblock', { params: { subjectId: m.profile.id }, ifMatch: m.version, idempotencyKey: key }));
      setConfirm(null);
      setNotice(`${m.profile.displayName} is unblocked. Your previous connection isn’t restored.`);
      await q.reload();
    } catch (e) {
      setError(e instanceof ApiError && e.kind === 'conflict' ? 'This setting changed. Reload and try again.' : 'We couldn’t unblock this member. Please try again.');
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scroll">
      <TitleBar title="Blocked members" subtitle="Settings · Privacy & safety" back="/settings" />
      <p className="prose">They can’t contact you privately. Meal groups you already share are unchanged. Nobody is told when you block or unblock them.</p>
      <FormMessage message={notice} tone="info" />
      {q.error ? <><FormMessage message={errorMessage(q.error)} /><Primary secondary onClick={() => void q.reload()}>Try again</Primary></>
        : !q.data ? <p className="muted" role="status">Loading blocked members…</p>
          : q.data.length === 0 ? <p className="muted" style={{ marginTop: 16 }}>You haven’t blocked anyone. You can block a member from their profile.</p>
            : (
              <ul className="nlist" style={{ marginTop: 12 }}>
                {q.data.map((m) => (
                  <li key={m.profile.id} className="irow">
                    <Link to={`/profiles/${m.profile.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }} aria-label={`Open ${m.profile.displayName}’s profile`}>
                      <Avatar name={m.profile.displayName} url={m.profile.avatarUrl} size={40} />
                      <b style={{ fontSize: 14 }}>{m.profile.displayName}</b>
                    </Link>
                    <TextAction className="inline" onClick={() => { setError(null); setConfirm(m); }} aria-label={`Unblock ${m.profile.displayName}`}>Unblock</TextAction>
                  </li>
                ))}
              </ul>
            )}
      <Sheet open={confirm !== null} onOpenChange={(o) => { if (!o && !busy) setConfirm(null); }} title={`Unblock ${confirm?.profile.displayName ?? ''}?`}>
        <p className="body">They won’t be told. Your previous choice to meet again isn’t restored; you can only reconnect after another shared meal.</p>
        <FormMessage message={error} />
        <Primary busy={busy} onClick={() => { if (confirm) void unblock(confirm); }}>Unblock</Primary>
        <TextAction disabled={busy} onClick={() => setConfirm(null)}>Keep blocked</TextAction>
      </Sheet>
    </div>
  );
}
