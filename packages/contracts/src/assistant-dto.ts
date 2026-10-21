import { DecimalString, Enum, Instant, LocalDate, Obj, Pence, T, Text, UniqueArray, Uuid } from './schema.ts';
import { DIETARY, LANGUAGE_CODES, MOODS } from './dictionaries.ts';
const codes=(values:Record<string,string>)=>Enum(Object.keys(values));
export const AIPreferenceFields=Obj({
  areas:UniqueArray(T.String({pattern:'^[a-z0-9]+(-[a-z0-9]+)*$',maxLength:80}),0,30),
  budgetMaxPence:T.Union([Pence,T.Null()]),tableSizes:UniqueArray(T.Integer({minimum:2,maximum:6}),0,5),
  dietaryCodes:UniqueArray(codes(DIETARY),0,2),languages:UniqueArray(Enum(LANGUAGE_CODES),0,5),moods:UniqueArray(codes(MOODS),0,3),
});
export const AIPreferences=Obj({fields:AIPreferenceFields,version:DecimalString,epoch:DecimalString,confirmedAt:T.Union([Instant,T.Null()])});
export const AIDraft=Obj({id:Uuid,kind:Enum(['APPLICATION','CREATE','GROUP']),targetId:T.Union([Uuid,T.Null()]),targetVersion:T.Union([DecimalString,T.Null()]),editorVersion:DecimalString,createdAt:Instant,text:T.Union([Text(1,1000),T.Null()]),fields:T.Union([Obj({title:Text(5,80),description:Text(20,1000)}),T.Null()])});
export const AIResult=Obj({
  replyText:Text(1,4000),
  draft:T.Optional(AIDraft),
  preferenceProposal:T.Optional(Obj({id:Uuid,fields:AIPreferenceFields,preferenceVersion:DecimalString})),
  comparison:T.Optional(T.Array(Obj({mealId:Uuid,title:Text(1,80),status:T.String({maxLength:40}),startsAt:Instant,budgetMaxPence:Pence,capacity:T.Integer({minimum:2,maximum:6}),version:DecimalString}),{maxItems:3})),
  cards:T.Array(Obj({mealId:Uuid,title:Text(1,80),startsAt:Instant,budgetMaxPence:Pence,capacity:T.Integer({minimum:2,maximum:6}),version:DecimalString}),{maxItems:3}),
});
export const AISession=Obj({sessionId:Uuid,generation:T.Integer({minimum:1}),deviceToken:T.String({pattern:'^[A-Za-z0-9_-]{43}$'}),revokeHandle:T.String({pattern:'^[A-Za-z0-9_-]{43}$'}),expiresAt:Instant});
export const AIRequestStatus=Obj({requestId:Uuid,sessionId:Uuid,generation:T.Integer({minimum:1}),state:Enum(['PENDING','SUCCEEDED','NEEDS_INPUT','FAILED','SUPERSEDED']),deadline:Instant,result:T.Union([AIResult,T.Null()]),errorCode:T.Union([T.String({maxLength:80}),T.Null()])});
export const AIHardFilters=Obj({
  cuisineCodes:T.Optional(UniqueArray(Enum(['EUROPEAN','JAPANESE','SPANISH','CHINESE']),0,4)),
  dates:T.Optional(UniqueArray(LocalDate,0,30)),
  areas:T.Optional(UniqueArray(T.String({pattern:'^[a-z0-9]+(-[a-z0-9]+)*$',maxLength:80}),0,30)),
  budgetMaxPence:T.Optional(Pence),tableSizes:T.Optional(UniqueArray(T.Integer({minimum:2,maximum:6}),0,5)),
  dietaryCodes:T.Optional(UniqueArray(codes(DIETARY),0,2)),languages:T.Optional(UniqueArray(Enum(LANGUAGE_CODES),0,5)),moods:T.Optional(UniqueArray(codes(MOODS),0,3)),
});
