/** Local synthetic rig only. Never imported by the API, worker or shipped admin application. */
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {EventEmitter} from 'node:events';
export function makeAdminFaults(origin:string){
 let loseClassification=false;
 let pageFailure:429|503|null=null;
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const path=(req.url??'').split('?')[0]!;
  if(path.startsWith('/__admin-test/fault/')){
   res.setHeader('cache-control','no-store');
   if(req.method!=='POST'||req.headers.origin!==origin){res.statusCode=403;res.end();return;}
   const action=path.slice('/__admin-test/fault/'.length);
   if(!['lost-classify','503','429','none'].includes(action)){res.statusCode=400;res.end();return;}
   loseClassification=action==='lost-classify';
   pageFailure=action==='503'?503:action==='429'?429:null;
   res.statusCode=204;res.end();return;
  }
  if(pageFailure&&req.method==='GET'&&/^\/v1\/admin\/(overview|journey|supply|retention|quality)$/.test(path)){
   const status=pageFailure;pageFailure=null;
   res.statusCode=status;res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
   if(status===429)res.setHeader('retry-after','3');
   res.end(JSON.stringify({error:{code:status===429?'RATE_LIMITED':'PROVIDER_UNAVAILABLE',message:'Synthetic one-shot acceptance fault'},meta:{requestId:'synthetic-admin-fault'}}));return;
  }
  next();
 };
 const attach=(proxy:EventEmitter)=>{
  proxy.on('proxyRes',(upstream:IncomingMessage,req:IncomingMessage,res:ServerResponse)=>{
   if(loseClassification&&req.method==='PUT'&&/^\/v1\/admin\/classifications\/[^/?]+(?:\?|$)/.test(req.url??'')){
    // proxyRes fires after the real API committed and began its response, before piping to the browser.
    loseClassification=false;upstream.destroy();res.destroy();
   }
  });
 };
 return {middleware,attach};
}
