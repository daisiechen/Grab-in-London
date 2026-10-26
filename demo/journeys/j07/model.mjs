
class Model{
constructor(){this.actor='U-REPORTER';this.target='U-424';this.targetType='member';this.screen='target';this.reason='';this.details='';this.error='';this.notice='';this.next='success';this.requests=0;this.records=[];this.current=null;this.unknownIntent=null;this.returnScreen='target';}
start(){if(!this.actor){this.error='Sign in to submit a private report.';return false;}this.screen='form';this.error='';return true;}
cancel(){this.screen=this.returnScreen;this.error='';}
submit(reason,details){this.reason=reason;this.details=details;this.error='';if(!this.actor){this.error='Sign in before submitting.';return false;}if(!['harassment','safety','other'].includes(reason)){this.error='Choose a reason for your report.';return false;}if(this.unknownIntent){this.error='Check the original request before sending again.';return false;}if(this.next==='failure'){this.next='success';this.error='Your report was not sent. Your description is kept; please try again.';return false;}const intent='REPORT-INTENT-'+(this.requests+1);this.requests++;const r={id:'SYN-R'+this.requests,owner:this.actor,target:this.target,targetType:this.targetType,reason,details,status:'RECEIVED',reply:null,intent};this.records.push(r);this.current=r.id;if(this.next==='unknown'){this.unknownIntent=intent;this.screen='unknown';this.notice='We could not confirm whether your report was received. Check this request before trying again.';}else{this.screen='receipt';this.notice='Received. We will review your report.';}this.next='success';return true;}
lookup(){const r=this.records.find(x=>x.intent===this.unknownIntent&&x.owner===this.actor);if(!r){this.error='This request is not available to this account.';return false;}this.current=r.id;this.unknownIntent=null;this.screen='receipt';this.notice='Your original report was received. It was not sent again.';return true;}
receipt(id=this.current){return this.records.find(r=>r.id===id&&r.owner===this.actor)||null;}
list(){return this.records.filter(r=>r.owner===this.actor);}
open(id){if(!this.receipt(id)){this.error='This report is not available to this account.';return false;}this.current=id;this.screen='receipt';return true;}
support(status){const r=this.records.find(r=>r.id===this.current);if(!r)return false;if(status==='IN_PROGRESS'&&r.status==='RECEIVED'){r.status=status;return true;}if(status==='REPLIED'&&r.status==='IN_PROGRESS'){r.status=status;r.reply='We reviewed the information you provided. You can leave the group or block the member if you wish. Contact support if the issue continues.';return true;}return false;}
switchActor(actor){this.actor=actor;this.screen='list';this.current=null;this.details='';this.reason='';this.unknownIntent=null;this.error='';this.notice='';}
}

export { Model };
