import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {it,expect,vi} from 'vitest';
import {productionAssistantBundle,approvalEvidenceValid} from './production-bundle.ts';
const syntheticProviderKey='synthetic-provider-fixture';
it('never reads credentials or sends startup probes when absent, disabled or approval files are absent',async()=>{const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(()=>{throw Error('NO_NETWORK');});try{expect(await productionAssistantBundle({bundleFile:null,apiKey:syntheticProviderKey,provider:'deepseek'})).toBeNull();expect(await productionAssistantBundle({bundleFile:'/missing',apiKey:null,provider:'deepseek'})).toBeNull();expect(await productionAssistantBundle({bundleFile:'/missing',apiKey:syntheticProviderKey,provider:'mock'})).toBeNull();expect(await productionAssistantBundle({bundleFile:'/missing',apiKey:syntheticProviderKey,provider:'deepseek'})).toBeNull();expect(fetch).not.toHaveBeenCalled();}finally{fetch.mockRestore();}});
it('rejects wrong model, expired manifest, unsupported keys and absent hosted evidence without loading provider',async()=>{const root=await mkdtemp(join(tmpdir(),'fancy-bundle-test-'));const p=join(root,'bundle.json');const m={schemaVersion:1,model:'deepseek-flash',revision:'DeepSeek-V4.1-Flash-1017',currency:'CNY',inputMicroCnyPerMillion:'2000000',outputMicroCnyPerMillion:'8000000',priceVersion:'synthetic-price',validFrom:'2026-10-20T00:00:00Z',validUntil:'2026-10-22T00:00:00Z',artifacts:{},approvals:{}};try{for(const change of [{model:'other'},{validUntil:'2026-10-20T00:00:00Z'},{verified:true},{}]){await writeFile(p,JSON.stringify({...m,...change}));expect(await productionAssistantBundle({bundleFile:p,apiKey:syntheticProviderKey,provider:'deepseek',now:()=>Date.parse('2026-10-21T00:00:00Z')})).toBeNull();}}finally{await rm(root,{recursive:true,force:true});}});

it('requires separately approved hosted protocol evidence; absence is never a zero bound',()=>{
 const now=Date.parse('2026-10-21T00:00:00Z'),until=now+1000;
 const e={scope:'COST',decision:'APPROVED',revision:'DeepSeek-V4.1-Flash-1017',approvedBy:'synthetic-reviewer',evidenceRef:'synthetic-proof-not-real',approvedAt:new Date(now).toISOString(),validUntil:new Date(until).toISOString(),protocolProofKind:'HOSTED_PROTOCOL_UPPER_BOUND',additionalInputTokenUpperBound:0,inputMicroCnyPerMillion:'2000000',outputMicroCnyPerMillion:'8000000'};
 expect(approvalEvidenceValid(e,'COST',until,now)).toBe(true);
 for(const change of [{additionalInputTokenUpperBound:undefined},{additionalInputTokenUpperBound:-1},{protocolProofKind:'OFFLINE_TEMPLATE_ONLY'},{decision:'PENDING'},{evidenceRef:''},{validUntil:'bad'},{revision:'different'},{approvedAt:new Date(now+1).toISOString()},{inputMicroCnyPerMillion:'1000000'}])expect(approvalEvidenceValid({...e,...change},'COST',until,now)).toBe(false);
});
