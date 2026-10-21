/** Offline operator tool. No credentials or ledger subjects are printed. */
import {readFile,writeFile,stat} from 'node:fs/promises';
import {loadConfig} from '../packages/config/src/index.ts';
import {createPool} from '../packages/db/src/index.ts';
import {Auth0IdentityProvider} from '../apps/api/src/identity/auth0-provider.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
import {ledgerDigest,requireRecovery,replayDeletionLedger,type DeletionLedger} from '../apps/api/src/recovery/replay.ts';
if(process.env.FANCY_OFFLINE_RECOVERY!=='1')throw new Error('Explicit offline recovery mode required; stop ingress and workers first');
const [action,path]=process.argv.slice(2);
if(!path||!['export','arm','replay'].includes(action??''))throw new Error('Usage: node infra/recovery.ts export|arm|replay <private-ledger-file>');
const config=loadConfig(process.env),pool=createPool(config.databaseUrl,{application:'fancy-offline-recovery'});
try{
 let ledger:DeletionLedger;
 if(action==='export'){
  const{rows}=await pool.query(`SELECT DISTINCT ON(user_id) user_id AS "userId",id AS "deletionId",requested_at AS "acceptedAt",receipt_token_hash AS "receiptTokenHash",expires_at AS "expiresAt",policy_version AS "policyVersion" FROM deletion_requests ORDER BY user_id,requested_at`);
  ledger={version:1,entries:rows.map(r=>({...r,acceptedAt:r.acceptedAt.toISOString(),expiresAt:r.expiresAt?.toISOString()??null}))};
  const digest=ledgerDigest(ledger);await writeFile(path,JSON.stringify(ledger),{flag:'wx',mode:0o600});console.warn(JSON.stringify({action,digest,entries:ledger.entries.length}));
 }else{
  if((await stat(path)).size>16*1024*1024)throw new Error('Ledger too large');
  ledger=JSON.parse(await readFile(path,'utf8')) as DeletionLedger;
  if(action==='arm')console.warn(JSON.stringify({action,digest:await requireRecovery(pool,ledger)}));
  else{
   const identity=config.adapters.AUTH_ADAPTER==='test'?new TestIdentityProvider(config.environment):new Auth0IdentityProvider(config.auth0!);
   console.warn(JSON.stringify({action,...await replayDeletionLedger({config,pool,identity,publicOrigin:config.webOrigin},ledger)}));
  }
 }
}finally{await pool.end();}
