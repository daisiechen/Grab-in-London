import {compareSeq} from './poller.ts';
/** Acknowledges only viewability events from the current visible screen, never a fetch completing. */
export class ReadAcknowledger {
 private active=false;private epoch=0;private attempted='0';private acknowledged='0';
 private scanned:{through:string;lastMessage:string|null}|null=null;
 private readonly send:(seq:string)=>Promise<void>;
 constructor(send:(seq:string)=>Promise<void>){this.send=send;}
 setActive(value:boolean){if(this.active!==value){this.active=value;this.epoch++;}}
 scannedThrough(through:string,lastMessage:string|null){this.scanned={through,lastMessage};}
 async presented(seqs:readonly string[]){
  if(!this.active||!seqs.length)return;
  let through=seqs.reduce((a,b)=>compareSeq(a,b)>0?a:b);
  // Advancing across server-scanned gaps is safe only after that page's last message was shown.
  if(this.scanned?.lastMessage&&compareSeq(through,this.scanned.lastMessage)>=0&&compareSeq(this.scanned.through,through)>0)through=this.scanned.through;
  if(compareSeq(through,this.attempted)<=0)return;
  this.attempted=through;const epoch=this.epoch;
  try{await this.send(through);if(this.active&&epoch===this.epoch&&compareSeq(through,this.acknowledged)>0)this.acknowledged=through;}catch{/* A failed acknowledgement does not schedule/retry itself. New rendered progress can try again. */}
 }
 get through(){return this.acknowledged;}
}
