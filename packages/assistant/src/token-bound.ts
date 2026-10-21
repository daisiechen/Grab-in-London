import {buildDeepSeekPayload,type ModelInput} from './provider.ts';
export const DEEPSEEK_MODEL='deepseek-flash';
export const DEEPSEEK_REVISION='DeepSeek-V4.1-Flash-1017';
export const TOKENIZER_COMMIT='1bae0e1088993b9b82de08f59de5be5a34e42170';
export const PUBLIC_ARTIFACTS={
 tokenizer:{file:'tokenizer.json',sha256:'c90dfa01249db1be4245780a052ede752e1361c612ac6d08e2bdada7d599476b'},
 encoding:{file:'encoding/encoding.py',sha256:'13231c592e958fb39e2af6001dae69d90e7a36b265702b9b390236fb387599e2'},
 config:{file:'tokenizer_config.json',sha256:'6ac8c8dc065ed118161d02dd532749ae3f52c243deac27872134fae2f50d8547'},
 license:{file:'LICENSE',sha256:'f2c6c602815669d292889e5be8c802f2ed950653b77999b1584e8e6aed25d040'},
} as const;
export const ARTIFACT_ORIGIN=`https://huggingface.co/deepseek-ai/${DEEPSEEK_REVISION}/resolve/${TOKENIZER_COMMIT}/`;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Re-check the structural facts used by the byte-BPE proof after the caller verifies the pinned hash. */
export function validateByteBpeTokenizer(value:unknown):boolean{
 if(!object(value)||!object(value.model)||!object(value.model.vocab))return false;
 const m=value.model;
 if(m.type!=='BPE'||m.dropout!==null||m.unk_token!==null||m.continuing_subword_prefix!==null||m.end_of_word_suffix!==null)return false;
 if(JSON.stringify(value.normalizer)!==JSON.stringify({type:'Sequence',normalizers:[]}))return false;
 const pre=value.pre_tokenizer;if(!object(pre)||pre.type!=='Sequence'||!Array.isArray(pre.pretokenizers))return false;
 if(pre.pretokenizers.length!==4||pre.pretokenizers.slice(0,-1).some(p=>!object(p)||p.type!=='Split'||p.behavior!=='Isolated'||p.invert!==false))return false;
 const last=pre.pretokenizers.at(-1);if(!object(last)||last.type!=='ByteLevel'||last.add_prefix_space!==false||last.use_regex!==false)return false;
 if(!object(value.post_processor)||value.post_processor.type!=='ByteLevel')return false;
 const bytes=[...Array.from({length:94},(_,i)=>i+33),...Array.from({length:12},(_,i)=>i+161),...Array.from({length:82},(_,i)=>i+174)];const chars=[...bytes];let extra=0;
 for(let b=0;b<256;b++)if(!bytes.includes(b))chars.push(256+extra++);
 if(chars.some(c=>!Object.hasOwn(m.vocab as object,String.fromCodePoint(c))))return false;
 return Array.isArray(value.added_tokens)&&value.added_tokens.every(t=>object(t)&&typeof t.content==='string'&&t.content.length>0);
}
/** Pinned official encoding.py text-only chat subset. Includes optional JSON-mode instruction conservatively. */
export function renderDeepSeekTextPrompt(request:Pick<ModelInput,'schema'|'input'|'maxOutputTokens'>):string{
 const payload=buildDeepSeekPayload(DEEPSEEK_MODEL,request);const system=payload.messages[0]!.content,user=payload.messages[1]!.content;
 if(!system.isWellFormed()||!user.isWellFormed())throw new Error('UNSUPPORTED_AI_TEXT');
 // Reserved model markup is not accepted as caller-controlled text. No vision/tools/continuations supported.
 if(/<｜|<\/?think>|<\/?image>/.test(user)||/<｜|<\/?think>|<\/?image>/.test(JSON.stringify(request.schema)))throw new Error('UNSUPPORTED_AI_TEXT');
 return '<｜begin▁of▁sentence｜><｜System｜>'+system+'\n\n## Response Format:\n\nYou MUST strictly adhere to the following schema to reply:\n{"type": "json_object"}'+'<｜User｜>'+user+'<｜Assistant｜></think>';
}
/** UTF8 bytes bound pinned byte-BPE tokens; extra bound must come from separately approved hosted protocol evidence. */
export function deepSeekInputUpperBound(request:Pick<ModelInput,'schema'|'input'|'maxOutputTokens'>,hostedProtocolExtraTokens:number):number{
 if(!Number.isSafeInteger(hostedProtocolExtraTokens)||hostedProtocolExtraTokens<0)throw new Error('AI_PROTOCOL_PROOF_REQUIRED');
 const n=Buffer.byteLength(renderDeepSeekTextPrompt(request),'utf8')+hostedProtocolExtraTokens;
 if(!Number.isSafeInteger(n))throw new Error('AI_TOKEN_BOUND_INVALID');return n;
}
