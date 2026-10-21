import { useTelemetry } from '../../api/telemetry.tsx';
import { Primary, FormError } from '../../ui/components.tsx';
import { useState } from 'react';

export function AnalyticsConsent({preferences=false}:{preferences?:boolean}) {
  const telemetry=useTelemetry();
  const [expanded,setExpanded]=useState(false);
  if(!preferences&&!expanded&&telemetry.choice!=='unknown'&&!telemetry.error)return <div className="body-pad"><button type="button" className="text-action" onClick={()=>setExpanded(true)}>Analytics preferences</button></div>;
  return <aside className="body-pad" aria-label="Optional analytics">
    <h2>Help improve Fancy</h2>
    <p>Allow optional usage analytics, including meal views and discovery results? We don’t collect message text or search keywords. You can decline and keep using Fancy.</p>
    {preferences&&<p>Analytics: {telemetry.enabled?'on':'off'}. Your choice lasts for this account session.</p>}
    <Primary secondary disabled={telemetry.busy} onClick={()=>{setExpanded(false);void telemetry.choose(true);}}>Allow analytics</Primary>
    <Primary secondary disabled={telemetry.busy} onClick={()=>{setExpanded(false);void telemetry.choose(false);}}>Decline analytics</Primary>
    <FormError>{telemetry.error}</FormError>
  </aside>;
}
