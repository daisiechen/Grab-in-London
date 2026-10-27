/** PJ inspection of PM prototypes in a clean Chromium. No UX/RD/QA dispatch.
 * URL/owner read credential arrive only on hidden stdin; never log headers/HAR.
 * All browser actions use real locators; evaluate() is read-only geometry/text.
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import readline from 'node:readline';
import {createHash} from 'node:crypto';
const modulePath=process.env.FANCY_PLAYWRIGHT_MODULE;
if(!modulePath)throw Error('Set FANCY_PLAYWRIGHT_MODULE to the isolated installed Playwright module.');
const {chromium}=await import(modulePath);
const scenarios={
 j01:async h=>{
  await h.click('[data-event="FILTER"]');await h.click('[data-event="DATE"]');await h.click('[data-event="CANCEL_FILTER"]');
  await h.click('[data-event="VIEW"]');await h.click('[data-event="APPLY"]');await h.click('[data-event="EMAIL"]');
  await h.set('#email','new@example.test');await h.submit('email-form');await h.set('#code','000000');await h.submit('code-form');await h.has('[role=alert]',/doesn’t match/);
  await h.set('#code','123456');await h.submit('code-form');
  for(const [k,v] of Object.entries({name:'Alex',bio:'I enjoy food, books and meeting new people over a relaxed meal.',status:'new',language:'en',interest:'Books',adult:true,community:true}))await h.set('#'+k,v);
  await h.submit('profile-form');await h.set('#message','Hello, I would enjoy a relaxed meal and meeting everyone at this table.');await h.set('#consent',true);await h.submit('apply-form');await h.has('#app',/Waiting for the host/);
  await h.click('[data-event="WITHDRAW_CONFIRM"]');await h.click('[data-event="WITHDRAW"]');await h.has('#app',/Application withdrawn/);await h.click('[data-event="REAPPLY"]');await h.visible('#apply-form');
 },
 j02:async h=>{
  await h.click('[data-action="EXISTING_HOST"]');await h.set('#query','Soho');await h.click('[data-action="SEARCH"]');await h.click('[data-action="VENUE"]');await h.set('#time','19:00');await h.click('[data-action="NEXT"]');
  await h.click('[data-action="AI_GENERATE"]');await h.click('[data-action="AI_TRANSFER"]');await h.click('[data-action="CANCEL_NO"]');await h.click('[data-action="NEXT"]');await h.set('#booking',true);await h.click('[data-action="NEXT"]');
  await h.click('[data-action="TERMS"]');await h.has('.dialog',/minimum/);await h.click('[data-action="CLOSE_TERMS"]');await h.set('#review',true);await h.click('[data-action="PUBLISH"]');await h.has('#app',/published/);
  await h.click('[data-action="ADD_APPLICANTS"]');await h.click('[data-action="DECIDE"][data-id="mia"][data-decision="CONFIRMED"]');await h.has('#app',/2\/4 confirmed/);await h.click('[data-action="EDIT"]');await h.has('#error',/locked/);
 },
 j03:async h=>{
  await h.click('[data-action="OPEN_CHAT"]');await h.set('#message','See you at seven!');await h.click('[data-action="OFFLINE"]');await h.click('[data-action="SEND"]');await h.has('#error',/not sent/);assert.equal(await h.value('#message'),'See you at seven!');
  await h.click('[data-action="OFFLINE"]');await h.click('[data-action="SEND"]');await h.has('#app',/See you at seven/);await h.click('[data-action="OPEN_SETTINGS"]');await h.click('[data-action="LEAVE_GROUP_REQUEST"]');await h.click('[data-action="LEAVE_GROUP_YES"]');await h.has('#app',/Left group/);await h.notHas('#app',/Current group members/);await h.click('[data-action="CLOSE_SETTINGS"]');await h.absent('#message');await h.has('#app',/See you at seven/);
 },
 j04:async h=>{
  await h.click('[data-action="REPORT_SELF"][data-value="present"]');await h.set('#score','4');await h.click('[data-action="SAVE_SCORE"]');await h.has('#notice',/private meal score/);await h.click('[data-action="OPEN_FEEDBACK"]');
  await h.set('#reference','A great conversation and a welcoming table.');await h.set('#reconnect',true);await h.click('[data-action="RECONNECT_FAULT"][data-value="failed"]');await h.click('[data-action="SAVE"]');await h.has('#app',/Reconnect choice could not be saved/);await h.click('[data-action="RETRY_FAILED"]');await h.click('[data-action="OTHER_RECONNECT"]');await h.click('[data-action="OPEN_DM"]');await h.set('#dm-message','Would you like to meet again?');await h.click('[data-action="SEND_DM"]');await h.has('#app',/Would you like to meet again/);await h.click('[data-action="REVOKE_REQUEST"]');await h.click('[data-action="REVOKE_YES"]');await h.absent('#dm-message');await h.has('#app',/Read-only history/);
 },
 j05:async h=>{
  await h.click('[data-e="EDIT"]');await h.set('#bio','A new introduction about meeting people through conversation and food.');await h.submit('profile-form');await h.has('#app',/new introduction/);await h.click('[data-e="SETTINGS"]');await h.click('[data-e="PREFS"]');await h.set('#budget','25');await h.set('#fault','prefs-conflict');await h.submit('prefs-form');await h.has('#app',/Latest saved budget: £45/);await h.click('[data-e="REVIEW_PREFS"]');await h.submit('prefs-form');await h.has('[role=status]',/saved after your confirmation/);await h.click('[data-e="CLEAR_BUDGET"]');await h.click('[data-e="QUERY_BUDGET"]');await h.has('[role=status]',/still has any budget/);await h.click('[data-e="DELETE_PREFS_CONFIRM"]');await h.click('[data-e="DELETE_PREFS"]');await h.has('[role=status]',/removed/);await h.click('[data-e="SIGNOUT_CONFIRM"]');await h.click('[data-e="SIGNOUT"]');await h.has('#app',/visitor/);
 },
 j06:async h=>{
  await h.click('[data-e="OPEN"]');await h.click('[data-e="SAVE"]');await h.has('[role=alert]',/Choose/);await h.click('[data-reason="conversation"]');await h.click('[data-e="SAVE"]');await h.has('#app',/Not answered/);await h.click('[data-e="BACK"]');await h.click('[data-e="OPEN"]');assert.equal(await h.page.locator('[data-reason="conversation"]').isChecked(),true);await h.click('[data-e="YES"]');await h.click('#fail');await h.click('[data-e="SAVE"]');await h.has('[role=alert]',/wasn’t saved/);await h.click('[data-e="SAVE"]');await h.has('#app',/Join again: Yes/);await h.click('[data-e="OPEN"]');await h.click('[data-e="CLEAR"]');await h.click('[data-e="SAVE"]');await h.has('#app',/Not answered/);
 },
 j07:async h=>{
  await h.click('[data-act="start"]');await h.set('#reason','safety');await h.set('#details','I would like help with this incident.');await h.set('#next','unknown');await h.submit('report');await h.has('main',/Check your report/);await h.click('[data-act="lookup"]');await h.has('h1',/Received/);await h.click('[data-act="list"]');await h.click('[data-report="SYN-R1"]');await h.click('[data-act="support-progress"]');await h.has('h1',/In progress/);await h.click('[data-act="support-reply"]');await h.has('h1',/Reply available/);await h.has('main',/We reviewed the information/);await h.set('#actor','U-OTHER');await h.has('main',/have not submitted/);await h.notHas('main',/I would like help/);
 },
 j08:async h=>{
  await h.click('[data-act="review"]');await h.has('h1',/Before you leave/);await h.click('[data-act="cancel"]');await h.click('[data-act="review"]');await h.click('[data-act="verify"]');await h.set('#code','123456');await h.submit('reauth');await h.set('#confirm',true);await h.set('#next','lost-response');await h.click('[data-act="delete"]');await h.has('h1',/saved receipt/);await h.click('[data-act="query"]');await h.has('h1',/Request accepted/);await h.click('[data-act="worker"]');await h.has('h1',/progress/);await h.click('[data-act="worker-fail"]');await h.has('h1',/Support needed/);await h.click('[data-act="support"]');assert.equal(await h.page.locator('#support-link').getAttribute('href'),'mailto:xcheniepaut26@gmail.com');await h.click('[data-act="copy"]');await h.has('#copy-status',/selected|copied/);await h.click('[data-act="back-status"]');await h.has('main',/No message has been marked as sent/);await h.click('[data-act="lose-receipt"]');await h.visible('#support-link');
 },
 j09:async h=>{
  await h.click('[data-act="start"]');await h.set('#reason','Case evidence checked with the reporter.');await h.click('[data-act="before7"]');await h.submit('correct');await h.has('[role=alert]',/CORRECTION_WINDOW_OPEN/);await h.click('[data-act="at7"]');await h.set('#value','absent');await h.submit('correct');await h.has('main',/PAUSED/);await h.has('main',/SYN-AFTER/);await h.click('[data-act="other-basis"]');await h.has('main',/OPEN/);await h.set('#outcome','Your report has been reviewed and a correction recorded.');await h.submit('reply');await h.has('.badge',/REPLIED/);await h.set('#role','analyst');await h.absent('#correct');await h.notHas('main',/本人原报告/);
 },
 j10:async h=>{
  await h.set('#from','2026-09-01');await h.set('#to','2026-10-26');await h.submit('query');await h.click('[data-metric="coverage"]');await h.has('.drawer',/本人优先/);await h.click('.drawer [data-act="sources"]');await h.click('.drawer [data-meal="M-101"]');await h.has('.drawer',/self present.*host absent/s);await h.click('.drawer [data-person="U-101"]');await h.has('.drawer',/M-102/);await h.click('.drawer [data-act="back"]');await h.click('.drawer [data-act="close"]');await h.absent('.drawer');await h.click('[data-act="locale"]');assert.equal(await h.value('#from'),'2026-09-01');await h.click('[data-fail="410"]');await h.has('main',/410/);await h.absent('[data-metric="coverage"]');await h.click('[data-act="recover"]');await h.visible('[data-metric="coverage"]');
 },
 j11:async h=>{
  await h.click('[data-act="export"]');await h.set('#next','unknown');await h.set('#reason','Synthetic reviewer account');await h.submit('classify');await h.has('.badge',/UNKNOWN/);await h.absent('[data-act="export"]');await h.click('[data-act="lookup"]');await h.click('[data-act="stats-fail"]');await h.has('.badge',/FAILED/);await h.click('[data-act="stats"]');await h.has('#result',/SYN-C2/);await h.click('[data-act="export"]');await h.click('[data-ticket="EXP-2"]');await h.has('#csv-result',/SYN-C2/);await h.downloadCSV('#csv-result a[download]',/SYN-C2/);await h.click('[data-act="revoke"]');await h.click('[data-ticket="EXP-2"]');await h.has('main',/410/);await h.click('[data-act="refresh"]');await h.click('[data-ticket="EXP-2"]');await h.has('main',/失效|revoked/);
 }
};
function helpers(page,steps,geometry){
 async function locator(selector){
  const el=page.locator(selector).first();
  const parents=el.locator('xpath=ancestor::details');
  for(let i=0;i<await parents.count();i++){const parent=parents.nth(i);if(await parent.getAttribute('open')===null)await parent.locator(':scope > summary').click();}
  return page.locator(selector).first();
 }
 return {page,
  click:async s=>{await(await locator(s)).click();steps.push('click '+s);await geometry('click '+s);},
  set:async(s,v)=>{const l=await locator(s);const tag=await l.evaluate(e=>({tag:e.tagName,type:e.type}));if(tag.type==='checkbox')await l.setChecked(v);else if(tag.tag==='SELECT')await l.selectOption(String(v));else await l.fill(String(v));steps.push('input '+s);await geometry('input '+s);},
  submit:async id=>{await(await locator('#'+id+' button:not([type="button"])')).click();steps.push('submit '+id);await geometry('submit '+id);},
  has:async(s,re)=>{await page.waitForFunction(({selector,source,flags})=>{const el=document.querySelector(selector);return el&&new RegExp(source,flags).test(el.innerText);},{selector:s,source:re.source,flags:re.flags},{timeout:5000});assert.match(await page.locator(s).first().innerText(),re);steps.push('verify '+s+' '+re);},
  notHas:async(s,re)=>assert.doesNotMatch(await page.locator(s).first().innerText(),re),
  downloadCSV:async(s,re)=>{const event=page.waitForEvent('download');await(await locator(s)).click();const download=await event;assert.equal(await download.failure(),null);const csv=readFileSync(await download.path(),'utf8');assert.match(csv,/snapshotId,definitionVersion,from,to,area,metric,numerator,denominator/);assert.match(csv,re);assert.doesNotMatch(csv,/email|receiptToken|messageBody/i);steps.push('download verified CSV sha256 '+createHash('sha256').update(csv).digest('hex'));},
  value:async s=>page.locator(s).first().inputValue(),
  visible:async s=>assert.equal(await page.locator(s).first().isVisible(),true),
  absent:async s=>assert.equal(await page.locator(s).count(),0)
 };
}
console.log('Ready for private PJ review configuration on hidden stdin.');
for await(const line of readline.createInterface({input:process.stdin,terminal:false})){
 const cfg=JSON.parse(line),origin=new URL(cfg.url).origin,out=cfg.output;mkdirSync(out,{recursive:true});
 const redact=s=>{const text=String(s).replaceAll(origin,'<private-origin>').replaceAll(process.cwd(),'<repository>');return cfg.token?text.replaceAll(cfg.token,'<credential>'):text;};
 const browser=await chromium.launch({headless:true});const rows=[];
 for(const width of (cfg.viewports||[1440])) for(let number=1;number<=11;number++){
  const slug='j'+String(number).padStart(2,'0');if(cfg.only&&!cfg.only.includes(slug))continue;
  const row={journey:slug.toUpperCase(),viewport:width,steps:[],pageErrors:[],requestFailures:[],geometryViolations:[],consoleMessages:[]};
  const context=await browser.newContext({viewport:{width,height:width<600?844:960},acceptDownloads:true});
  await context.route('**/*',async route=>{if(new URL(route.request().url()).origin===origin)await route.continue({headers:{...route.request().headers(),...(cfg.token?{'OAI-Sites-Authorization':'Bearer '+cfg.token}:{})}});else await route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>row.pageErrors.push(redact(e.message)));
  page.on('console',msg=>{if(['error','warning'].includes(msg.type()))row.consoleMessages.push({level:msg.type(),text:redact(msg.text())});});
  page.on('requestfailed',r=>row.requestFailures.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  const geometry=async action=>{const box=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main,#app,.phone,.review,.drawer,.prd-body')].map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1)}));if(box.documentWidth>box.viewport+1)row.geometryViolations.push({action,...box});};
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator(`[data-prd="${slug}"]`).click();
   assert.equal(await page.locator('#prd-content pre').textContent(),readFileSync(`docs/product/journeys/${slug}/requirements.zh-CN.md`,'utf8'));row.prd='visible-full-text-matches-source';row.prdPresentation=await page.locator('#prd-content .prd-body').count()?'formatted':'raw-markdown';await geometry('read PRD');if(cfg.capturePRD)await page.screenshot({path:`${out}/${slug}-${width}-prd.png`,fullPage:true});
   await page.locator('#prd-back').click();await page.locator(`a[href="${slug}/index.html"]`).click();await page.waitForLoadState('domcontentloaded');row.demoPath=new URL(page.url()).pathname;
   const paired=page.getByRole('link',{name:/阅读对应PRD/});if(await paired.count()){await paired.click();await page.waitForLoadState('domcontentloaded');assert.equal(new URL(page.url()).hash,'#prd-'+slug);assert.equal(await page.locator('#prd-reader').isVisible(),true);assert.equal(await page.locator('#prd-content pre').textContent(),readFileSync(`docs/product/journeys/${slug}/requirements.zh-CN.md`,'utf8'));row.demoToPRD='clicked-and-read-matching-PRD';await page.goBack({waitUntil:'domcontentloaded'});}else row.demoToPRD='paired-through-hub';
   await geometry('open Demo');await scenarios[slug](helpers(page,row.steps,geometry));assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.geometryViolations,[],'page overflow in '+slug+' at '+width);
   await page.screenshot({path:`${out}/${slug}-${width}-flow-complete.png`,fullPage:true});row.status='flow-passed';
  }catch(e){row.status='flow-failed';row.failure=redact(e.stack);await page.screenshot({path:`${out}/${slug}-${width}-flow-failure.png`,fullPage:true}).catch(()=>{});}
  rows.push(row);console.log(JSON.stringify({journey:row.journey,viewport:width,status:row.status,steps:row.steps.length,failure:row.failure?.slice(0,450)}));
  writeFileSync(`${out}/${cfg.reportName||'flows.json'}`,JSON.stringify({reviewRole:'PJ',stagesStarted:['PM'],stagesNotStarted:['UX','RD','QA'],browser:browser.version(),rows},null,2));await context.close();
 }
 await browser.close();process.exit(rows.some(r=>r.status==='flow-failed')?1:0);
}
