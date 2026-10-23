import { AssistantError } from '../../../../packages/assistant/src/index.ts';
import type { HardFilters } from './context.ts';
export const INTENTS=['SEARCH','COMPARE','EXPLAIN','DRAFT_APPLICATION','DRAFT_CREATE','DRAFT_GROUP','PREFERENCE_PROPOSAL','CLARIFY','OUT_OF_SCOPE'] as const;
export type AIIntent=(typeof INTENTS)[number];
export interface Patch {field:string;op:'SET'|'CLEAR';value:unknown;source:string}
export interface QueryPlan {intent:AIIntent;patches:Patch[];mealIds:string[]}
export const querySchema={type:'object',additionalProperties:false,required:['intent','patches','mealIds'],properties:{intent:{type:'string',enum:INTENTS},patches:{type:'array',maxItems:10,items:{type:'object',additionalProperties:false,required:['field','op','value','source'],properties:{field:{type:'string',enum:['areas','budgetMaxPence','tableSizes','dietaryCodes','languages','moods','dates','cuisineCodes','keyword','timeOfDay','bounds']},op:{type:'string',enum:['SET','CLEAR']},value:{},source:{type:'string',maxLength:2000}}}},mealIds:{type:'array',maxItems:3,uniqueItems:true,items:{type:'string',format:'uuid'}}}};
const fail=()=>{throw new AssistantError('AI_CONFLICT');};
export function validatePlan(value:unknown,input:string):QueryPlan{
  if(!value||typeof value!=='object'||Array.isArray(value))return fail();
  const o=value as Record<string,unknown>;
  if(Object.keys(o).sort().join(',')!=='intent,mealIds,patches'||!INTENTS.includes(o.intent as AIIntent)||!Array.isArray(o.patches)||o.patches.length>10||!Array.isArray(o.mealIds)||o.mealIds.length>3||new Set(o.mealIds).size!==o.mealIds.length||o.mealIds.some(x=>typeof x!=='string'||!/^[0-9a-f-]{36}$/i.test(x)))return fail();
  const fields=new Set<string>();
  for(const value of o.patches){
    if(!value||typeof value!=='object'||Array.isArray(value))return fail();
    const p=value as Patch;
    if(Object.keys(p).sort().join(',')!=='field,op,source,value'||!['SET','CLEAR'].includes(p.op)||typeof p.source!=='string'||!p.source.trim()||!input.includes(p.source)||fields.has(p.field))return fail();
    if(!['areas','budgetMaxPence','tableSizes','dietaryCodes','languages','moods','dates','cuisineCodes','keyword','timeOfDay','bounds'].includes(p.field))return fail();
    fields.add(p.field);
  }
  return o as unknown as QueryPlan;
}
const iso=(d:Date)=>d.toISOString().slice(0,10);
const plus=(d:Date,days:number)=>new Date(d.getTime()+days*86400_000);
export function londonDates(source:string,now:Date):{dates:string[];tonight:boolean}|null{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const base=new Date(`${today}T00:00:00Z`);const day=base.getUTCDay();const s=source.toLowerCase().trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const d=new Date(`${s}T00:00:00Z`);return Number.isFinite(d.getTime())&&iso(d)===s&&s>=today?{dates:[s],tonight:false}:null;}
  if(/^(tonight|今晚)$/.test(s))return {dates:[today],tonight:true};
  if(/^(today|今天)$/.test(s))return {dates:[today],tonight:false};
  if(/^(tomorrow|明天)$/.test(s))return {dates:[iso(plus(base,1))],tonight:false};
  if(/^(next friday|下周五)$/.test(s)){const nextMonday=(8-day)%7||7;return {dates:[iso(plus(base,nextMonday+4))],tonight:false};}
  if(/^(friday|周五|星期五|this friday)$/.test(s))return {dates:[iso(plus(base,(5-day+7)%7))],tonight:false};
  if(/^(weekend|this weekend|周末|本周末)$/.test(s)){
    const saturday=(6-day+7)%7;const sat=plus(base,saturday);const sun=day===0?base:plus(sat,1);
    return {dates:day===0?[iso(sun)]:[iso(sat),iso(sun)],tonight:false};
  }
  return null;
}
const aliases:Record<string,Record<string,readonly string[]>>={
  languages:{en:['english','英语'],zh:['chinese','mandarin','中文','普通话'],fr:['french','法语'],es:['spanish','西班牙语'],hi:['hindi','印地语']},
  dietaryCodes:{VEGAN:['vegan','纯素'],VEGETARIAN_OPTIONS:['vegetarian','素食']},
  moods:{EASY_CONVERSATION:['easy conversation','轻松聊天'],FOOD_DISCOVERIES:['food discoveries','探索美食'],TRAVEL_CULTURE:['travel','culture','旅行','文化']},
  cuisineCodes:{SPANISH:['spanish food','spanish cuisine','西班牙菜'],CHINESE:['chinese food','chinese cuisine','中餐'],JAPANESE:['japanese','日料','日本菜'],EUROPEAN:['european','欧餐']},
};
export function applyPlan(plan:QueryPlan,input:string,applied:HardFilters,previous:{hard:Record<string,unknown>;cleared:string[]},allowedAreas:readonly string[],now:Date){
  const hard={...applied,...previous.hard} as HardFilters;const explicit={...previous.hard};const cleared=new Set(previous.cleared);
  for(const field of cleared)delete (hard as Record<string,unknown>)[field];
  let clarification=false;
  if(/\bspanish\b|西班牙/.test(input.toLowerCase())&&!/\bspanish\s+(food|cuisine|language)\b|\blanguage(?:\s*:\s*|\s+)spanish\b|\bspeak\s+spanish\b|西班牙菜|西班牙语/i.test(input))clarification=true;
  for(const p of plan.patches){
    const source=p.source.toLowerCase();
    if(p.op==='CLEAR'){
      const subjects:Record<string,RegExp>={budgetMaxPence:/budget|cost|price|spend|预算|金额|价格|花费/,areas:/area|location|where|place|地区|区域|地点|位置/,tableSizes:/size|people|persons|table|人数|几人/,dietaryCodes:/diet|vegan|vegetarian|饮食|素食/,languages:/language|speak|语言|语种/,moods:/mood|atmosphere|vibe|氛围/,dates:/date|day|time|日期|时间|哪天/,cuisineCodes:/cuisine|food|菜系|菜种/,keyword:/keyword|search text|named|called|关键词|关键字|名称/,timeOfDay:/time|lunch|dinner|时段|午餐|晚餐/,bounds:/map|bounds|viewport|地图|范围/};
      if(!subjects[p.field]?.test(source))return fail();
      if(p.value!==null||!/(no\b.*(limit|preference)|any\b|remove\b|clear\b|不限|无所谓|不限制|清除)/i.test(source))return fail();
      delete (hard as Record<string,unknown>)[p.field];delete explicit[p.field];
      if(p.field==='dates'){delete (hard as Record<string,unknown>).tonight;delete explicit.tonight;}
      cleared.add(p.field);continue;
    }
    let value=p.value;
    if(p.field==='budgetMaxPence'){
      const amount=/(?<![\d.−-])[£]\s*(\d+(?:\.\d{1,2})?)(?![\d.])/.exec(source)??/(?<![\d.一二三四五六七八九十百千万零两−-])(\d+(?:\.\d{1,2})?|[一二三四五六])\s*(?:pounds?\b|英镑|镑)/.exec(source);
      const beforeSource=input.slice(0,input.indexOf(p.source)).at(-1)??'';
      const chineseAmounts:Record<string,number>={一:1,二:2,三:3,四:4,五:5,六:6};
      const pounds=amount?(chineseAmounts[amount[1]!]??Number(amount[1])):NaN;
      if(!amount||/[\d.一二三四五六七八九十百千万零两−-]/.test(beforeSource)||typeof value!=='number'||!Number.isSafeInteger(value)||value!==Math.round(pounds*100)||value<1)return fail();
    }else if(p.field==='bounds'){
      // Geometry is chosen by the map, never fabricated by the model. Explicit CLEAR is above.
      return fail();
    }else if(p.field==='keyword'){
      if(typeof value!=='string'||!value.trim()||value.length>120||!source.includes(value.toLowerCase())||!/keyword|search for|named|called|关键词|关键字|名为|叫/.test(source))return fail();
      value=value.trim();
    }else if(p.field==='timeOfDay'){
      if(value!=='lunch'&&value!=='dinner')return fail();
      if(!(value==='lunch'?/lunch|午餐|午饭/:/dinner|晚餐|晚饭/).test(source))return fail();
    }else if(p.field==='dates'){
      const parsed=londonDates(p.source,now);if(!parsed){clarification=true;continue;}
      value=parsed.dates;
      if(parsed.tonight){(hard as Record<string,unknown>).tonight=true;explicit.tonight=true;}
      else {delete (hard as Record<string,unknown>).tonight;delete explicit.tonight;}
    }else{
      if(!Array.isArray(value)||!value.length||new Set(value).size!==value.length)return fail();
      if(p.field==='areas'){
        if(value.some(v=>typeof v!=='string'||!allowedAreas.includes(v)||!source.includes(v.replaceAll('-',' '))))return fail();
      }else if(p.field==='tableSizes'){
        const words:Record<number,string>={2:'two|二|两',3:'three|三',4:'four|四',5:'five|五',6:'six|六'};
        const sizeContext=(v:number)=>new RegExp(`\\b(?:tables?|seats?)\\s+for\\s+(?:${words[v]})\\b|\\b(?:${words[v]})\\s+(?:people|persons?|seats?)\\b|(?:${words[v]})(?:人|位|人桌)`,'i').test(input);
        const ambiguous=/\b(twenty|thirty|forty|fifty|sixty|hundred)\b|\b(two|three|four|five|six)\s*(?:or|to|-)\s*(two|three|four|five|six)\b|[二三四五六]\s*(?:或|至|到)\s*[二三四五六]/i.test(input);
        if(value.some(v=>!Number.isInteger(v)||v<2||v>6||(!new RegExp(`(^|[^0-9])${v}([^0-9]|$)`).test(source)&&(!sizeContext(v)||ambiguous||!new RegExp(`(?<![a-z一二三四五六七八九十百千万零两])(?:${words[v]})(?![a-z一二三四五六七八九十百千万零两])`,'i').test(source)))))return fail();
      }else{
        const dictionary=aliases[p.field];if(!dictionary||value.some(v=>typeof v!=='string'||!dictionary[v]?.some(alias=>source.includes(alias))))return fail();
      }
    }
    (hard as Record<string,unknown>)[p.field]=value;explicit[p.field]=value;cleared.delete(p.field);
  }
  if(plan.intent==='SEARCH'){
    const has=(field:string)=>plan.patches.some(p=>p.field===field);
    if(/[£]\s*\d/.test(input)&&!has('budgetMaxPence'))clarification=true;
    if(/\b(cheap|cheaper|minimum|at least|above|over)\b|便宜|至少|以上/i.test(input))clarification=true;
    if(/\b(friday|tonight|today|tomorrow|weekend)\b|周五|今晚|今天|明天|周末|\d{4}-\d{2}-\d{2}/i.test(input)&&!has('dates'))clarification=true;
    if(/\b(lunch|dinner)\b|午餐|午饭|晚餐|晚饭/i.test(input)&&!has('timeOfDay')&&!hard.timeOfDay)clarification=true;
    const areaMentioned=allowedAreas.filter(area=>input.toLowerCase().includes(area.replaceAll('-',' ')));
    if(areaMentioned.some(area=>!hard.areas?.includes(area)))clarification=true;
  }
  return {hard,conditions:{hard:explicit,cleared:[...cleared]},clarification};
}
