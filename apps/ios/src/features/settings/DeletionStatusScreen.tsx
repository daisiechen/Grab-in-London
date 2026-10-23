import { useEffect, useRef, useState } from 'react';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { Primary } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading } from '../../ui/Text.tsx';

type Status = ResponseOf<'deletionStatus'>['data'];
const LABELS: Record<Status['status'], string> = { PENDING: 'Requested', PROCESSING: 'In progress', COMPLETED: 'Completed', NEEDS_SUPPORT: 'Our support team is completing this' };

/** Status by receipt token only (sent in the body, never in a URL). Works signed out. */
export function DeletionStatusScreen() {
  const { deletionStatus, deletionReceipts, session:auth } = useServices();
  const session=useSessionState();
  const currentScope=useRef('');
  const requestVersion=useRef(0);
  const editVersion=useRef(0);
  const scope=`${auth.generation}:${session.status==='signedIn'?session.session.user.id:session.status}`;
  currentScope.current=scope;
  const [reference,setReference]=useState({scope,token:''});
  const token=reference.scope===scope?reference.token:'';
  const setToken=(value:string)=>{editVersion.current+=1;requestVersion.current+=1;setReference({scope,token:value});setStatus(null);setBusy(false);};
  const [savedToken,setSavedToken]=useState({scope,token:''});
  useEffect(()=>{let active=true;const editAtStart=editVersion.current;requestVersion.current+=1;setReference({scope,token:''});setSavedToken({scope,token:''});setStatus(null);setError(null);setBusy(false);
    if(session.status==='signedIn'||session.status==='signedOut')void deletionReceipts.read().then(saved=>{if(active&&saved&&(session.status==='signedOut'||saved.ownerId===session.session.user.id)){if(editVersion.current===editAtStart)setReference({scope,token:saved.receiptToken});setSavedToken({scope,token:saved.receiptToken});}},()=>{if(active)setError('We couldn’t load your saved reference. You can enter a copy you saved.');});
    return()=>{active=false;requestVersion.current+=1;};
  },[deletionReceipts,scope]);
  const [result,setResult]=useState<{scope:string;status:Status|null}>({scope,status:null});
  const status=result.scope===scope?result.status:null;
  const setStatus=(value:Status|null)=>setResult({scope,status:value});
  const [problem,setProblem]=useState<{scope:string;message:string|null}>({scope,message:null});
  const error=problem.scope===scope?problem.message:null;
  const setError=(value:string|null)=>setProblem({scope,message:value});
  const [activity,setActivity]=useState({scope,busy:false});
  const busy=activity.scope===scope&&activity.busy;
  const setBusy=(value:boolean)=>setActivity({scope,busy:value});

  const check = async () => {
    const t = token.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return setError('Enter the 43-character reference you saved.');
    const version=++requestVersion.current;
    setBusy(true);
    setError(null);
    try {
      const result=await deletionStatus(t);
      if(currentScope.current===scope&&requestVersion.current===version)setStatus(result.data);
    } catch (e) {
      if(currentScope.current!==scope||requestVersion.current!==version)return;
      setStatus(null);
      setError(e instanceof ApiError && e.kind === 'gone' ? 'This reference has expired.' : e instanceof ApiError && e.kind === 'not_found' ? 'We couldn’t find that reference.' : 'We couldn’t check the status. Please try again.');
    } finally {
      if(currentScope.current===scope&&requestVersion.current===version)setBusy(false);
    }
  };

  return (
    <Screen testID="deletion-status">
      <Heading>Check deletion status</Heading>
      <Field label="Deletion reference" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
      <Primary label="Check status" busy={busy} onPress={() => void check()} />
      {savedToken.scope===scope&&savedToken.token?<Primary secondary label="Forget saved reference" onPress={()=>{const expected=savedToken.token;requestVersion.current+=1;setBusy(false);void deletionReceipts.clear(expected).then(()=>{if(currentScope.current===scope){setToken('');setSavedToken({scope,token:''});setStatus(null);setError('Saved reference removed from this device. This does not cancel account deletion.');}},()=>{if(currentScope.current===scope)setError('We couldn’t forget the saved reference. Please try again.');});}}/>:null}
      <FormMessage message={error} />
      {status ? <Body>{`Status: ${LABELS[status.status]}`}</Body> : null}
    </Screen>
  );
}
