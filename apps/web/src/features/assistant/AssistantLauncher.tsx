import {useRef,useState} from 'react';
import {useAssistant} from './context.tsx';
import {FancySprite} from './AssistantPanel.tsx';
/** Pointer dragging has the same keyboard alternatives as the approved Demo launcher. */
export function AssistantLauncher(){
 const a=useAssistant();const [side,setSide]=useState<'left'|'right'>('right'),[top,setTop]=useState(72),[tucked,setTucked]=useState(false);const drag=useRef<{x:number;y:number;top:number;moved:boolean}|null>(null),suppress=useRef(false);
 if(a.open)return null;
 return <div className={`assistant-dock ${side}${tucked?' tucked':''}`} style={{top:`${top}%`}}>
  <button type="button" id="fancy-assistant-launcher" className="assistant-launcher" aria-label="Ask Fancy" aria-haspopup="dialog" onPointerDown={event=>{if(event.button!==0)return;drag.current={x:event.clientX,y:event.clientY,top,moved:false};event.currentTarget.setPointerCapture?.(event.pointerId);}} onPointerMove={event=>{if(!drag.current)return;const dy=event.clientY-drag.current.y;if(Math.hypot(event.clientX-drag.current.x,dy)>6)drag.current.moved=true;if(drag.current.moved)setTop(Math.max(15,Math.min(82,drag.current.top+dy/window.innerHeight*100)));}} onPointerUp={event=>{if(drag.current?.moved){setSide(event.clientX<window.innerWidth/2?'left':'right');suppress.current=true;}drag.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={event=>{if(!event.key.startsWith('Arrow'))return;event.preventDefault();if(event.key==='ArrowLeft'||event.key==='ArrowRight')setSide(event.key==='ArrowLeft'?'left':'right');else setTop(value=>Math.max(15,Math.min(82,value+(event.key==='ArrowUp'?-5:5))));}} onClick={event=>{if(suppress.current&&event.detail!==0){suppress.current=false;return;}a.show();}}>
   <FancySprite/>{!tucked&&<span>Ask Fancy{a.busy&&<small>Working…</small>}</span>}
  </button>
  <button type="button" className="assistant-tuck" aria-label={tucked?'Show Fancy label':'Tuck Fancy to edge'} onClick={()=>setTucked(value=>!value)}>{tucked?'＋':side==='right'?'›':'‹'}</button>
 </div>;
}
