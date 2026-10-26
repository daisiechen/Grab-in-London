export const REASONS={company:'The people',conversation:'The conversation',coordination:'Making arrangements',expectations:'My expectations',venue:'The venue',cost:'The cost',other:'Something else'};
export function initial(){return {screen:'settings',userId:'user-alex',again:null,reasons:[],saved:null,version:0,error:'',notice:'',fail:false,attended:false,daysAfterMeal:9};}
export function step(state,e){const s=JSON.parse(JSON.stringify(state));s.error='';s.notice='';switch(e.type){
case 'OPEN':s.screen='survey';if(s.saved){s.again=s.saved.again;s.reasons=[...s.saved.reasons];}break;
case 'AGAIN':s.again=e.value===true?true:e.value===false?false:null;break;
case 'REASON':if(!Object.hasOwn(REASONS,e.value))break;s.reasons=s.reasons.includes(e.value)?s.reasons.filter(x=>x!==e.value):[...s.reasons,e.value];break;
case 'SAVE':if(s.again===null&&s.reasons.length===0){s.error='Choose an answer or at least one reason before saving.';break;}if(s.fail){s.fail=false;s.error='Your feedback wasn’t saved. Your choices are still here. Try again.';break;}s.version++;s.saved={userId:s.userId,again:s.again,reasons:[...new Set(s.reasons)],version:s.version,submittedAt:'2026-10-26T12:00:'+String(s.version).padStart(2,'0')+'Z'};s.screen='saved';s.notice='Your latest feedback is saved privately.';break;
case 'CANCEL':s.again=s.saved?.again??null;s.reasons=[...(s.saved?.reasons||[])];s.screen='settings';break;
case 'BACK':s.screen='settings';break;
case 'FAIL':s.fail=true;break;
case 'ATTENDANCE':s.attended=e.value;break;
case 'ADVANCE':s.daysAfterMeal+=7;break;
}return s;}
