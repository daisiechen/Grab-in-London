export const END=Date.parse('2026-10-30T21:00:00Z'),DAY=86400000;
export function pairKey(a,b){return [a,b].sort().join(':');}
export function createState(){return {screen:'past',actor:'mia',target:'alex',now:END+DAY,end:END,meal:{id:'meal-j04',title:'Friday at Olive Table',cancelled:false},users:{mia:{name:'Mia',host:false,roster:true,self:null,hostReport:null,support:null,score:null},alex:{name:'Alex',host:true,roster:true,self:'present',hostReport:null,support:null,score:null},noah:{name:'Noah',host:false,roster:false,self:null,hostReport:null,support:null,score:null}},reviews:{},pairs:{},inputs:{},results:{},dm:{},blocks:[],confirm:null,error:'',notice:'',reviewFailure:'',reconnectFailure:'',otherBasis:false,writes:{review:0,reconnect:0,score:0,attendance:0,message:0,revoke:0},accountEpoch:1};}
export function attendance(s,id){const u=s.users[id];return u.support??u.self??u.hostReport??'unknown';}
export function windowOpen(s){return s.now>=s.end&&s.now<s.end+7*DAY;}
export function eligible(s,id){return !s.meal.cancelled&&s.users[id].roster&&attendance(s,id)==='present';}
export function feedbackKey(s){return s.actor+':'+s.target;}
export function pair(s,a=s.actor,b=s.target){return s.pairs[pairKey(a,b)]??{consents:{},epoch:1};}
export function blocked(s,a=s.actor,b=s.target){return s.blocks.includes(a+':'+b)||s.blocks.includes(b+':'+a);}
export function connectionOpen(s,a=s.actor,b=s.target){const p=pair(s,a,b);return !blocked(s,a,b)&&!!p.consents[a]&&!!p.consents[b]&&((eligible(s,a)&&eligible(s,b))||s.otherBasis);}
export function published(s,a,b){const r=s.reviews[a+':'+b];if(!r||!eligible(s,a)||!eligible(s,b))return false;return !!s.reviews[b+':'+a]||s.now>=s.end+7*DAY;}
export function input(s){const k=feedbackKey(s);if(!s.inputs[k])s.inputs[k]={body:s.reviews[k]?.body??'',selected:!!pair(s).consents[s.actor]};return s.inputs[k];}
function revoke(s){const k=pairKey(s.actor,s.target),p=pair(s);s.pairs[k]={consents:{},epoch:p.epoch+1};s.writes.revoke++;for(const who of [s.actor,s.target])if(s.inputs[who+':'+(who===s.actor?s.target:s.actor)])s.inputs[who+':'+(who===s.actor?s.target:s.actor)].selected=false;}
function runQueue(s){const k=feedbackKey(s),r=s.results[k];if(!r)return;const d=input(s);if(r.review==='pending'||r.review==='failed'){
 if(!windowOpen(s)||!eligible(s,s.actor)||!eligible(s,s.target)||s.actor===s.target){r.review='failed';r.reviewMessage='Public reference was not saved: the feedback window or attendance eligibility is no longer valid.';r.reconnectMessage=r.reconnect==='pending'?'Not saved yet':r.reconnectMessage;return;}
 const fault=s.reviewFailure;s.reviewFailure='';if(fault==='failed'){r.review='failed';r.reviewMessage='Public reference could not be saved. Your text is preserved.';r.reconnectMessage=r.reconnect==='pending'?'Not saved yet':r.reconnectMessage;return;}
 if(fault==='conflict'){r.review='conflict';r.reviewMessage='Reference changed on another device. Latest version loaded; compare your preserved draft before confirming.';return;}
 s.reviews[k]={body:r.body,version:(s.reviews[k]?.version??0)+1};s.writes.review++;if(fault==='unknown'){r.review='unknown';r.reviewMessage='Status unknown. Check the saved reference before continuing.';return;}
 r.review='saved';r.reviewMessage=published(s,s.actor,s.target)?'Public reference saved and published.':'Public reference saved. It is not public yet.';
 }
 if(r.review==='unknown'||r.review==='conflict')return;
 if(r.reconnect==='pending'||r.reconnect==='failed'){
 if(r.revoke){revoke(s);r.reconnect='saved';r.reconnectMessage='Connection withdrawn. Both choices cleared; past chat is read-only.';return;}
 if(!windowOpen(s)||!eligible(s,s.actor)||!eligible(s,s.target)||s.actor===s.target||blocked(s)){r.reconnect='failed';r.reconnectMessage='Reconnect choice could not be saved: eligibility, block status or the feedback window changed.';return;}
 const fault=s.reconnectFailure;s.reconnectFailure='';if(fault){r.reconnect=fault==='unknown'?'unknown':'failed';r.reconnectMessage=fault==='unknown'?'Reconnect status unknown. Check before trying again.':'Reconnect choice could not be saved. Your choice is preserved.';if(fault==='unknown'){const p=pair(s);p.consents[s.actor]=r.selected;s.pairs[pairKey(s.actor,s.target)]=p;s.writes.reconnect++;}return;}
 const p=pair(s);p.consents[s.actor]=r.selected;s.pairs[pairKey(s.actor,s.target)]=p;s.writes.reconnect++;r.reconnect='saved';r.reconnectMessage=connectionOpen(s)?'You both chose to reconnect. Private chat is available.':'Your private choice is saved.';
 }
}
function prepareSave(s,confirmed=false){const pending=s.results[feedbackKey(s)];if(pending&&(pending.review==='unknown'||pending.reconnect==='unknown'||pending.review==='conflict')){s.error='Check the previous result or confirm the conflict before starting a new save.';return;}const d=input(s),k=feedbackKey(s),old=s.reviews[k]?.body??'',body=d.body.trim(),p=pair(s),recDirty=d.selected!==!!p.consents[s.actor],reviewDirty=body!==old;
 if(reviewDirty&&!body&&old){s.error='An existing public reference cannot be replaced with an empty value. Your draft is kept.';return;}
 if(body.length>500){s.error='Use 1–500 characters for a public reference.';return;}
 if(!reviewDirty&&!recDirty){s.notice='No changes to save';return;}
 const needsRevoke=recDirty&&!d.selected&&connectionOpen(s);if(needsRevoke&&!confirmed){s.confirm='save-revoke';return;}
 s.results[k]={body,selected:d.selected,review:reviewDirty&&body?'pending':'unchanged',reconnect:recDirty?'pending':'unchanged',revoke:needsRevoke,reviewMessage:reviewDirty?'Not saved yet':'No reference changes',reconnectMessage:recDirty?'Not saved yet':'No reconnect changes'};runQueue(s);}
export function transition(state,a){let s=JSON.parse(JSON.stringify(state));s.error='';s.notice='';switch(a.type){
case 'OPEN_FEEDBACK':s.screen='feedback';input(s);break;case 'OPEN_PAST':s.screen='past';break;
case 'REPORT_SELF':if(!windowOpen(s)||!s.users[s.actor].roster||s.meal.cancelled)s.error='Attendance reporting is closed or unavailable. Contact support for a correction.';else{s.users[s.actor].self=a.value;s.writes.attendance++;s.notice='Your attendance report is saved. Your own report takes priority.';}break;
case 'REPORT_HOST':if(!s.users[s.actor].host||!windowOpen(s)||!s.users[a.subject]?.roster)s.error='Only this meal’s host can report an eligible guest during the reporting window.';else{s.users[a.subject].hostReport=a.value;s.writes.attendance++;s.notice='Host report saved. A guest’s own report takes priority.';}break;
case 'SCORE':s.scoreDraft=a.value;break;
case 'SAVE_SCORE':if(!windowOpen(s)||!eligible(s,s.actor))s.error='A meal score needs your valid attendance and an open feedback window.';else if(!Number.isInteger(+s.scoreDraft)||+s.scoreDraft<1||+s.scoreDraft>5)s.error='Choose a whole-number score from 1 to 5.';else{s.users[s.actor].score=+s.scoreDraft;s.writes.score++;s.notice='Your private meal score is saved. It is not shared with your table.';}break;
case 'BODY':input(s).body=a.value;break;case 'SELECTED':input(s).selected=a.value;break;
case 'SAVE':prepareSave(s);break;
case 'SAVE_REVOKE_YES':if(s.confirm==='save-revoke'){s.confirm=null;prepareSave(s,true);}break;
case 'CANCEL_CONFIRM':s.confirm=null;break;
case 'RETRY_FAILED':runQueue(s);break;
case 'CHECK_STATUS':{const r=s.results[feedbackKey(s)];if(r?.review==='unknown'){r.review='saved';r.reviewMessage=published(s,s.actor,s.target)?'Public reference saved and published.':'Public reference saved. It is not public yet.';runQueue(s);}if(r?.reconnect==='unknown'){r.reconnect='saved';r.reconnectMessage=connectionOpen(s)?'You both chose to reconnect. Private chat is available.':'Your private choice is saved.';}break;}
case 'CONFIRM_CONFLICT':{let r=s.results[feedbackKey(s)];if(r?.review==='conflict'){r.review='pending';runQueue(s);}break;}
case 'OPEN_DM':{const p=pairKey(s.actor,s.target);if(connectionOpen(s)||(s.dm[p]&&s.dm[p].length))s.screen='dm';else s.error='Private chat becomes available only when you both choose to reconnect and attendance is valid.';break;}
case 'DM_DRAFT':s.dmDraft=a.value;break;
case 'SEND_DM':if(!connectionOpen(s))s.error='This private chat is read-only. Your unsent message is preserved.';else if(!s.dmDraft?.trim()||s.dmDraft.trim().length>2000)s.error='Write a message of 1–2000 characters.';else{const p=pairKey(s.actor,s.target);if(!s.dm[p])s.dm[p]=[];s.dm[p].push({actor:s.actor,body:s.dmDraft.trim()});s.dmDraft='';s.writes.message++;s.notice='Message sent.';}break;
case 'REVOKE_REQUEST':s.confirm='revoke';break;case 'REVOKE_YES':if(s.confirm==='revoke'){revoke(s);s.notice='Connection withdrawn. Your previous chat remains read-only.';}s.confirm=null;break;
case 'BLOCK_REQUEST':s.confirm='block';break;case 'BLOCK_YES':if(s.confirm==='block'){const k=s.actor+':'+s.target;if(!s.blocks.includes(k))s.blocks.push(k);revoke(s);s.notice='Person blocked. Shared meal group membership is unchanged.';}s.confirm=null;break;
case 'UNBLOCK':s.blocks=s.blocks.filter(k=>k!==s.actor+':'+s.target);s.notice='Person unblocked. Previous reconnect choices were not restored.';break;
case 'ACTOR':if(s.users[a.id]){s.actor=a.id;s.target=a.id==='alex'?'mia':'alex';s.screen='past';s.confirm=null;s.dmDraft='';s.scoreDraft='';s.accountEpoch++;}break;
case 'TARGET':if(s.users[a.id]&&a.id!==s.actor){s.target=a.id;s.screen='feedback';s.confirm=null;input(s);}break;
case 'OTHER_RECONNECT':{const p=pair(s);if(eligible(s,s.actor)&&eligible(s,s.target)&&windowOpen(s)&&!blocked(s)){p.consents[s.target]=true;s.pairs[pairKey(s.actor,s.target)]=p;s.notice='Other participant completed their own private choice (synthetic event).';}break;}
case 'OTHER_REVIEW':if(eligible(s,s.target)&&eligible(s,s.actor))s.reviews[s.target+':'+s.actor]={body:'A thoughtful and friendly dinner companion.',version:1};break;
case 'ADVANCE_7D':s.now=s.end+7*DAY;break;case 'BEFORE_END':s.now=s.end-1;break;
case 'IN_WINDOW':s.now=s.end+DAY;break;
case 'SUPPORT_ABSENT':s.users[s.actor].support='absent';break;case 'CLEAR_SUPPORT':s.users[s.actor].support=null;break;
case 'OTHER_BASIS':s.otherBasis=!s.otherBasis;break;
case 'REVIEW_FAULT':s.reviewFailure=a.value;break;case 'RECONNECT_FAULT':s.reconnectFailure=a.value;break;
case 'RESET':return createState();}return s;}
