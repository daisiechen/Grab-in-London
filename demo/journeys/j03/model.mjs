export function createState(){return {screen:'inbox',actor:'mia',seq:3,meal:{id:'meal-j03',title:'Friday at Olive Table',status:'OPEN',startsAt:Date.parse('2026-10-30T19:00:00Z')},now:Date.parse('2026-10-29T12:00:00Z'),users:{mia:{name:'Mia',host:false,seat:'CONFIRMED',intervals:[{join:1,leave:null}],readSeq:1,draft:''},alex:{name:'Alex',host:true,seat:'HOST',intervals:[{join:1,leave:null}],readSeq:1,draft:''},sam:{name:'Sam',host:false,seat:'PENDING',intervals:[],readSeq:0,draft:''}},messages:[{id:'m2',seq:2,actor:'alex',body:'Looking forward to Friday. Shall we meet by the entrance?'},{id:'m3',seq:3,actor:'mia',body:'Sounds good! I’ll be there a few minutes early.'}],notifications:[{id:'n1',actor:'mia',body:'Your application was approved. Your seat is confirmed.',read:false},{id:'n2',actor:'alex',body:'Mia’s application is ready to review.',read:false}],dissolved:false,offline:false,showLatest:true,error:'',notice:'',confirm:null,aiDraft:null,aiAvailable:true,failNext:false,accountEpoch:1,sendEpoch:null,sends:0};}
export function active(s,id=s.actor){return !s.dissolved&&s.users[id].intervals.some(i=>i.leave===null);}
export function visibleMessages(s,id=s.actor){const u=s.users[id];return s.messages.filter(m=>u.intervals.some(i=>i.join<m.seq&&(i.leave===null||m.seq<i.leave)));}
export function unread(s,id=s.actor){return visibleMessages(s,id).filter(m=>m.actor!==id&&m.seq>s.users[id].readSeq).length;}
export function transition(state,a){let s=JSON.parse(JSON.stringify(state));s.error='';s.notice='';const u=s.users[s.actor];switch(a.type){
case 'OPEN_MEAL':s.screen='meal';break;case 'OPEN_INBOX':s.screen='inbox';break;
case 'OPEN_CHAT':if(!u.intervals.length){s.error='Your application is still pending. Group chat opens after approval.';}else{s.screen='chat';s.showLatest=true;}break;
case 'OPEN_SETTINGS':if(!u.intervals.length)s.error='You do not have access to this group.';else s.screen='settings';break;
case 'CLOSE_SETTINGS':s.screen='chat';break;
case 'DRAFT':u.draft=a.value;break;
case 'VISIBLE':if(s.screen==='chat'&&s.showLatest){const xs=visibleMessages(s);if(xs.length)u.readSeq=Math.max(u.readSeq,xs[xs.length-1].seq);}break;
case 'READ_NOTICE':{let n=s.notifications.find(n=>n.id===a.id&&n.actor===s.actor);if(n)n.read=true;break;}
case 'SEND':{if(!active(s)){s.error='This group is read-only. Your unsent text is preserved.';break;}if(s.offline||s.failNext){s.failNext=false;s.error='Message not sent. Your text is safe. Try again when connected.';break;}const text=u.draft.trim();if(!text||text.length>2000){s.error='Write a message of 1–2000 characters.';break;}s.seq++;s.messages.push({id:'m'+s.seq,seq:s.seq,actor:s.actor,body:text});u.draft='';s.sends++;s.notice='Message sent.';break;}
case 'OTHER_MESSAGE':{const actor=s.actor==='alex'?'mia':'alex';if(active(s,actor)){s.seq++;s.messages.push({id:'m'+s.seq,seq:s.seq,actor,body:a.body||'I’ve checked the route. See you at the restaurant entrance.'});}break;}
case 'LEAVE_SEAT_REQUEST':if(u.host)s.error='Hosts cancel the meal for everyone; they cannot use a guest seat exit.';else if(s.now>=s.meal.startsAt)s.error='This meal has started. Use attendance reporting or contact support.';else if(u.seat==='CONFIRMED')s.confirm='seat';else s.error='There is no confirmed seat to leave.';break;
case 'LEAVE_SEAT_YES':if(s.confirm==='seat'&&u.seat==='CONFIRMED'&&s.now<s.meal.startsAt){u.seat='CANCELLED';s.notifications.push({id:'n'+(s.notifications.length+1),actor:'alex',body:'Mia left their seat. Group membership is unchanged.',read:false});s.notice='You left your seat. You are still in the group.';}s.confirm=null;break;
case 'LEAVE_GROUP_REQUEST':if(active(s))s.confirm='group';break;
case 'LEAVE_GROUP_YES':if(s.confirm==='group'&&active(s)){s.seq++;const i=u.intervals.find(i=>i.leave===null);i.leave=s.seq;s.screen='settings';s.notice='Left group. Your meal participation has not changed.';}s.confirm=null;break;
case 'DISSOLVE_REQUEST':if(!u.host||!active(s))s.error='Only the host with current group access can dissolve the group.';else s.confirm='dissolve';break;
case 'DISSOLVE_YES':if(s.confirm==='dissolve'&&u.host&&active(s)){s.seq++;for(const x of Object.values(s.users))for(const i of x.intervals)if(i.leave===null)i.leave=s.seq;s.dissolved=true;s.notice='Group dissolved. Everyone keeps their authorised history read-only. Seats are unchanged.';}s.confirm=null;break;
case 'CANCEL_CONFIRM':s.confirm=null;break;
case 'ACTOR':if(s.users[a.id]){s.actor=a.id;s.screen='inbox';s.aiDraft=null;s.confirm=null;s.accountEpoch++;}break;
case 'REAPPLY':if(u.seat==='CANCELLED'&&s.now<s.meal.startsAt&&s.meal.status==='OPEN'){u.seat='PENDING';s.notice='New application pending. Waiting does not restore group access.';}else s.error='Leave your seat before submitting a new application.';break;
case 'APPROVE_CURRENT':if(u.seat==='PENDING'&&s.meal.status==='OPEN'&&s.now<s.meal.startsAt){u.seat='CONFIRMED';if(!s.dissolved&&!u.intervals.some(i=>i.leave===null)){s.seq++;u.intervals.push({join:s.seq,leave:null});}s.notifications.push({id:'n'+(s.notifications.length+1),actor:s.actor,body:'Your new application was approved. Check the meal for current arrangements.',read:false});s.notice='Application approved. Your authorised intervals are preserved.';}break;
case 'MEAL_CANCELLED':s.meal.status='CANCELLED';s.notifications.push({id:'n'+(s.notifications.length+1),actor:s.actor,body:'The meal was cancelled. Existing group chat remains available.',read:false});break;
case 'MEAL_ENDED':s.meal.status='COMPLETED';break;
case 'OFFLINE':s.offline=!s.offline;break;
case 'FAIL_NEXT':s.failNext=true;break;
case 'OLDER':s.showLatest=false;break;case 'LATEST':s.showLatest=true;s=transition(s,{type:'VISIBLE'});break;
case 'AI_GENERATE':if(!active(s))s.error='Only current group writers can create a message draft.';else if(!s.aiAvailable)s.error='Ask Fancy is temporarily unavailable. Your own message is unchanged.';else s.aiDraft='Looking forward to our meal on Friday at Olive Table. Shall we meet by the entrance?';break;
case 'AI_TRANSFER':if(!active(s)){s.error='Group access changed. The draft cannot be transferred.';break;}if(s.aiDraft)s.confirm='replace';break;
case 'AI_REPLACE':if(s.confirm==='replace'&&active(s)){u.draft=s.aiDraft;s.confirm=null;s.notice='Draft added. Edit it and choose Send when ready.';}break;
case 'AI_AVAILABLE':s.aiAvailable=!s.aiAvailable;break;
case 'RESET':return createState();}return s;}
