import { useParams } from 'react-router';
import type { ResponseOf } from '@fancy/client';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import { FormError, Loading, PageHeader } from '../../ui/components.tsx';

type Receipt = ResponseOf<'reportStatus'>['data'];
const STATUS: Record<Receipt['status'], string> = { RECEIVED: 'Received', IN_REVIEW: 'In review', RESPONDED: 'Responded' };

/** Own report status and public outcome only; never internal investigation notes (T18). */
export function ReportStatusPage() {
  const { reportId = '' } = useParams();
  const { state } = useSession();
  const q = useQuery<Receipt>(state.status === 'signed-in' ? `report:${reportId}` : null, async (c) => (await c.call('reportStatus', { params: { reportId } })).data);
  return (
    <>
      <PageHeader title="Your report" backTo="/settings" />
      <div className="body-pad">
        {state.status === 'guest' ? <p className="muted">Sign in to see your report.</p>
          : !q.data ? (q.error ? <FormError>{errorMessage(q.error)}</FormError> : <Loading />) : (
            <>
              <h1>Report {q.data.receipt}</h1>
              <div className="settings-info-row"><span>Status</span><strong>{STATUS[q.data.status]}</strong></div>
              <div className="settings-info-row"><span>Sent</span><span>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' }).format(new Date(q.data.createdAt))}</span></div>
              {q.data.publicOutcome && <><h2>Outcome</h2><p className="prose">{q.data.publicOutcome}</p></>}
            </>
          )}
      </div>
    </>
  );
}
