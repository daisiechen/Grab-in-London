import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDownIcon} from '@radix-ui/react-icons';
import './time-picker.css';
/** Planned London time only; choosing a slot never asserts restaurant availability. */
export function TimePicker({id,value,onChange,options,disabled=false,...aria}:{id:string;value:string;onChange:(value:string)=>void;options:readonly string[];disabled?:boolean;'aria-describedby'?:string;'aria-invalid'?:true}){
 const menuId=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),items=useRef<Array<HTMLButtonElement|null>>([]);
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState({left:0,top:0,width:160,height:224});
 const close=(restore=true)=>{setOpen(false);if(restore)trigger.current?.focus();};
 const show=()=>{if(disabled)return;setActive(Math.max(0,options.indexOf(value)));setOpen(true);};
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(160,Math.max(0,window.innerWidth-32));const below=window.innerHeight-rect.bottom-8,above=rect.top-8;const down=below>=224||below>=above;const height=Math.max(0,Math.min(224,down?below:above));setPosition({left:Math.max(16,Math.min(rect.left,window.innerWidth-width-16)),top:down?rect.bottom+4:rect.top-height-4,width,height});};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open]);
 useLayoutEffect(()=>{if(open){const option=items.current[active];option?.focus({preventScroll:true});option?.scrollIntoView?.({block:'nearest'});}},[open,active]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{const target=event.target;if(target instanceof Node&&!menu.current?.contains(target)&&!trigger.current?.contains(target))close(false);};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 const choose=(index:number)=>{const next=options[index];if(next!==undefined)onChange(next);close();};
 const key=(event:KeyboardEvent)=>{
  if(event.key==='Escape'){event.preventDefault();close();}
  else if(event.key==='Tab')close();
  else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setActive(i=>event.key==='Home'?0:event.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,i+(event.key==='ArrowDown'?1:-1))));}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(active);}
 };
 return <><button {...aria} id={id} ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?menuId:undefined} disabled={disabled} className="time-picker-trigger" onClick={()=>open?close():show()} onKeyDown={event=>{if(!open&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();show();}else if(open)key(event);}}>{value||'Choose a time'}<ChevronDownIcon aria-hidden="true"/></button>
 {open&&createPortal(<div id={menuId} ref={menu} role="listbox" aria-label="Time" className="time-picker-menu" style={{left:position.left,top:position.top,width:position.width,maxHeight:position.height}} onKeyDown={key}>{options.map((option,index)=><button type="button" key={option} ref={element=>{items.current[index]=element;}} role="option" aria-selected={option===value} tabIndex={-1} className={active===index?'active':''} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}>{option}</button>)}</div>,document.body)}</>;
}
