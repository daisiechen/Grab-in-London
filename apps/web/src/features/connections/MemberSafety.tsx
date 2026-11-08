import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { ApiError, type ResponseOf } from '@fancy/client';
import {useSignedIn} from '../../api/session.tsx';
import { useApi } from '../../api/ApiProvider.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { FormMessage, Notice, TextAction } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { useToast } from '../../ui/toast.tsx';

type BlockState = ResponseOf<'block'>['data'];

/**
 * Block / unblock a member (iOS MemberSafety, T15). Blocking clears both reconnect consents and stops
 * private contact; shared meal groups are unaffected; unblocking never restores a connection.
 */
export function MemberSafety({ subjectId, name }: { subjectId: string; name: string }) {
  const me=useSignedIn();
  return me?<MemberSafetyForActor key={`${me.user.id}:${subjectId}`} subjectId={subjectId} name={name}/>:null;
}
function MemberSafetyForActor({subjectId,name}:{subjectId:string;name:string}){
  const { api } = useApi();
  const notify = useToast();
  const [sheet, setSheet] = useState<'' | 'block'>('');
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
  const readFeedback=<>{loading&&<p className="muted" role="status">Loading safety settings…</p>}<FormMessage message={error&&!sheet?error:null}/>{!loading&&!block&&<TextAction disabled={busy} onClick={()=>void reload()}>Reload safety settings</TextAction>}</>;

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
      notify(blocked ? 'Member blocked. Private contact is disabled. Shared groups are unchanged.' : 'Member unblocked. Your previous connection is not restored.');
    } catch (e) {
      if(generation!==life.current)return;
      if(e instanceof ApiError&&e.status===409){setSheet('');setBlock(null);await reload();if(generation===life.current)notify('Safety settings changed. Review the refreshed setting and confirm again.');return;}
      if(generation===life.current)setError(errorMessage(e));
    }finally{
      if(generation===life.current){writing.current=false;setBusy(false);}
    }
  };

  const blocking=!block?.blocked;
  return (
    <div className="actions">
      {block?.blocked && <Notice role="status">You have blocked {name}. Private contact is disabled; shared meal groups are unchanged.</Notice>}
      {readFeedback}
      {block && <TextAction danger disabled={busy||loading} onClick={() => { setError(''); setSheet('block'); }}>{block.blocked ? `Unblock ${name}` : `Block ${name}`}</TextAction>}
      <ConfirmSheet open={sheet === 'block'} onOpenChange={(o) => { if (!o && !busy) setSheet(''); }} title={`${blocking ? 'Block' : 'Unblock'} ${name}?`} keepLabel="Cancel"
        confirmLabel={blocking ? 'Confirm block' : 'Confirm unblock'} busy={busy||loading||!block} error={error} onConfirm={() => void setBlocked(blocking)}>
        {blocking && <p>Private messages will stop and both reconnect choices will be cleared. Shared meal groups are unaffected.</p>}
        <p>Your previous connection will not be restored. Both people must choose again.</p>
      </ConfirmSheet>
    </div>
  );
}
