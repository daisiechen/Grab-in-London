import type {RequestOf,ResponseOf} from '@fancy/client';
import {ApiError} from '@fancy/client';
import {parseFilters} from '../discover/filters.ts';
export type AISession=ResponseOf<'bootstrapAI'>['data'];
export type AIStatus=ResponseOf<'pollAI'>['data'];
export type AIResult=NonNullable<AIStatus['result']>;
export type AIDraft=NonNullable<AIResult['draft']>;
export type Preferences=ResponseOf<'readAIPreferences'>['data'];
export type PreferenceFields=Preferences['fields'];
export type AssistantEditor={kind:AIDraft['kind'];targetId:string|null;version:string;text:string;apply:(draft:AIDraft)=>void};
export type AssistantTurn={id:string;input:string;status:AIStatus|null;error:string|null};
export const emptyFields=():PreferenceFields=>({areas:[],budgetMaxPence:null,tableSizes:[],dietaryCodes:[],languages:[],moods:[]});
export const emptyPreferences=():Preferences=>({fields:emptyFields(),version:'0',epoch:'0',confirmedAt:null});
export const secretToken=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
export function assistantError(error:unknown):string{
 if(!(error instanceof ApiError))return 'Fancy could not complete that request. Please try again.';
 switch(error.code){
  case 'AI_UNAVAILABLE':case 'PROVIDER_UNAVAILABLE':return 'Fancy is temporarily unavailable. Your meal plans and editors are still available.';
  case 'AI_BUDGET_EXCEEDED':return 'Fancy has reached its service limit for now. You can still use all meal features.';
  case 'AI_QUOTA_EXCEEDED':case 'RATE_LIMITED':return 'You’ve reached the current request limit. Please try again later.';
  case 'AI_SESSION_EXPIRED':case 'AI_RESULT_EXPIRED':return 'This conversation has expired. Your unsent message is kept; start a new conversation.';
  case 'AI_SUPERSEDED':return 'Your context changed while Fancy was working. Please review and ask again.';
  case 'AI_CONFLICT':case 'VERSION_CONFLICT':return 'These details changed elsewhere. Reload them and confirm again.';
  case 'DRAFT_EXPIRED':return 'This draft has expired. Ask Fancy for a new draft.';
  case 'TARGET_CHANGED':return 'This meal or conversation changed. Check the original page before continuing.';
  case 'EDITOR_CONFLICT':return 'Your editor changed. Keep your text, or explicitly replace it with this draft.';
  case 'AUTH_REQUIRED':return 'Sign in before using this action.';
  case 'FORBIDDEN':return 'This action is no longer available. Please check the original page.';
  case 'NETWORK_ERROR':return 'You appear to be offline. Your unsent message is kept.';
  default:return 'Fancy could not complete that request. Please try again.';
 }
}
export function routeContext(path:string,search:string):Pick<RequestOf<'requestAI'>['body'],'sourcePage'|'explicitMealId'|'explicitConversationId'|'appliedFilters'> {
 const meal=/^\/meals\/([0-9a-f-]{36})(?:\/|$)/i.exec(path);
 const conversation=/^\/inbox\/([0-9a-f-]{36})(?:\/|$)/i.exec(path);
 const filters=parseFilters(new URLSearchParams(search));
 return {sourcePage:path.startsWith('/create')?'CREATE':meal?'MEAL':path.startsWith('/inbox')?'INBOX':path.startsWith('/profile')?'PROFILE':'DISCOVER',...(meal?{explicitMealId:meal[1]!}:{}),...(conversation?{explicitConversationId:conversation[1]!}:{}),...(path==='/discover'?{appliedFilters:{...(filters.dates.length?{dates:filters.dates}:{}),...(filters.areaCodes.length?{areas:filters.areaCodes}:{}),...(filters.budgetMaxPence?{budgetMaxPence:filters.budgetMaxPence}:{}),...(filters.tableSizes.length?{tableSizes:filters.tableSizes}:{}),...(filters.languages.length?{languages:filters.languages}:{}),...(filters.moods.length?{moods:filters.moods}:{}),...(filters.cuisineCodes.length?{cuisineCodes:filters.cuisineCodes}:{}),...(filters.dietaryCodes.length?{dietaryCodes:filters.dietaryCodes}:{})}}:{})};
}
