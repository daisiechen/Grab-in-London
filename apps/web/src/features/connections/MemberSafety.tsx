import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { ApiError, type ResponseOf } from '@fancy/client';
import {useSignedIn} from '../../api/session.tsx';
import { useApi } from '../../api/ApiProvider.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { FormError, Notice, Primary, TextAction } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { ReportSheet } from '../reports/ReportSheet.tsx';

type BlockState = ResponseOf<'block'>['data'];

/**
 * "Report or block this member" (T15/T18). Blocking clears both reconnect consents and stops
 * private contact; shared meal groups are unaffected; unblocking never restores a connection.
 */
export function MemberSafety({ subjectId, name }: { subjectId: string; name: string }) {
  const me=useSignedIn();
  return me?<MemberSafetyForActor key={`${me.user.id}:${subjectId}`} subjectId={subjectId} name={name}/>:null;
}
function MemberSafetyForActor({subjectId,name}:{subjectId:string;name:string}){
  const { api } = useApi();
  const notify = useToast();
  const [sheet, setSheet] = useState<'' | 'menu' | 'report' | 'block'>('');
  const [block, setBlock] = useState<BlockState | null>(null);
  const [error, setError] = useState('');
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const life=useRef(0),writing=useRef(false),readJob=useRef<Promise<void>|null>(null);
  const reload=useCallback(()=>{
    if(readJob.current)return readJob.current;
    const generation=life.current;setLoading(true);setError('');
    const job=(async()=>{try{const res=await api.client.call('getBlock',{params:{subjectId}});if(generation===life.current)setBlock(res.data);}catch(e){if(generation===life.current){setBlock(null);setError(errorMessage(e));}}finally{if(generation===life.current)setLoading(false);}})();
    readJob.current=job;void job.finally(()=>{if(readJob.current===job)readJob.current=null;});return job;
  },[api,subjectId]);
  useEffect(()=>{void reload();return()=>{life.current++;readJob.current=null;};},[reload]);
  const version=block?.version;
  const readFeedback=<>{loading&&<p role="status">Loading block status…</p>}<FormError>{error}</FormError>{!loading&&!block&&<TextAction disabled={busy} onClick={()=>void reload()}>Retry block status</TextAction>}</>;

  const setBlocked = async (blocked: boolean) => {
    if(writing.current||loading||!version)return;
    writing.current=true;setBusy(true);const generation=life.current;
    setError('');
    try {
      const op = blocked ? 'block' : 'unblock';
      const res = await intent.run({ op, subjectId, version }, (key) => api.client.call(op, { params: { subjectId }, ifMatch: version, idempotencyKey: key }));
      if(generation!==life.current)return;
      setBlock(res.data);
      setSheet('');
      notify(blocked ? 'Member blocked. A new mutual connection is required after unblocking.' : 'Member unblocked. Your previous connection is not restored.');
    } catch (e) {
      if(generation!==life.current)return;
      if(e instanceof ApiError&&e.status===409){setBlock(null);await reload();}
      if(generation===life.current)setError(errorMessage(e));
    }finally{
      if(generation===life.current){writing.current=false;setBusy(false);}
    }
  };

  return (
    <>
      {block?.blocked && (
        <>
          <Notice role="status">You have blocked this member. Private contact is disabled.</Notice>
          <TextAction disabled={busy||loading} onClick={() => void setBlocked(false)}>Unblock {name}</TextAction>
        </>
      )}
      <TextAction onClick={() => setSheet('menu')}>Report or block this member</TextAction>
      {!sheet&&readFeedback}
      <Sheet open={sheet === 'menu'} onOpenChange={(o) => !o && setSheet('')} title={`${name}`}>
        {readFeedback}
        <Primary secondary disabled={busy} onClick={() => setSheet('report')}>Report a concern</Primary>
        {!block?.blocked && <Primary secondary disabled={busy||loading||!block} onClick={() => setSheet('block')}>Block {name}</Primary>}
      </Sheet>
      <ReportSheet open={sheet === 'report'} onOpenChange={(o) => setSheet(o ? 'report' : '')} target={{ type: 'USER', id: subjectId, label: name }} />
      <ConfirmSheet open={sheet === 'block'} onOpenChange={(o) => !o && setSheet('')} title={`Block ${name}?`} confirmLabel="Block member" busy={busy||loading||!block} error={error} onConfirm={() => void setBlocked(true)}>
        <p>Private messages will stop. Unblocking will not restore your connection; you will both need to choose again. Shared groups are unaffected.</p>
      </ConfirmSheet>
    </>
  );
}
