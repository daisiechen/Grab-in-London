import {describe,expect,it} from 'vitest';
import {mealPathFromLink,mealShareUrl,publicMealInvitation,publicMealOrigin} from './share.ts';
const origin='https://p11-share.example.invalid',id='14141414-1414-4141-8141-141414141414';
const meal={id,title:'Friday supper',startsAt:{localDate:'2026-10-25',localTime:'01:30',utcOffsetMinutes:0},area:'Soho, London',status:'OPEN' as const};
describe('public meal sharing',()=>{
 it('creates a canonical URL with no actor, token or application fields',()=>{
  const shared=publicMealInvitation(origin,{...meal,token:'private-token',host:{email:'private@example.invalid'},application:{body:'private-body'}} as typeof meal);
  expect(shared.url).toBe(`${origin}/meals/${id}`);
  expect(JSON.stringify(shared)).not.toMatch(/private/);
  expect(shared.text).toContain('01:30 GMT');
  expect(new URL(shared.whatsappUrl).searchParams.get('text')).toBe(shared.text);
 });
 it.each(['http://example.invalid','https://user:secret@example.invalid','https://example.invalid/path','https://example.invalid/?token=x','https://example.invalid/#x'])('rejects unsafe origin %s',value=>expect(()=>publicMealOrigin(value)).toThrow());
 it('does not turn an ID into a path or query',()=>expect(()=>mealShareUrl(origin,`${id}?token=x`)).toThrow());
 it.each(['CANCELLED','COMPLETED'] as const)('uses View meal without a join promise for %s',status=>{
  const result=publicMealInvitation(origin,{...meal,status});
  expect(result.text).toContain('View meal:');expect(result.text).not.toMatch(/join|seat reserved/i);
 });
 it('accepts only the configured public detail link',()=>{
  expect(mealPathFromLink(origin,mealShareUrl(origin,id))).toBe(`/meals/${id}`);
  for(const link of [`https://evil.invalid/meals/${id}`,`${origin}/meals/${id}/apply`,`${origin}/meals/${id}?returnTo=https://evil.invalid`,`${origin}/meals/not-a-meal`,`${origin}/meals/${id}#token`])expect(mealPathFromLink(origin,link)).toBeNull();
 });
 it('rejects nonpublic runtime states',()=>expect(()=>publicMealInvitation(origin,{...meal,status:'DRAFT' as 'OPEN'})).toThrow());
});
