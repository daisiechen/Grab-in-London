import { expect, expectTypeOf, it, vi } from 'vitest';
import type { RequestOf } from './types.ts';
import { createApiClient } from './http.ts';

it('retains precise new message and mute request fields', () => {
 expectTypeOf<RequestOf<'sendGroupMessageV2'>['body']['mentions'][number]>().toEqualTypeOf<{kind:'user';userId:string;start:number;end:number}|{kind:'everyone';start:number;end:number}>();
 expectTypeOf<RequestOf<'putConversationNotificationSettings'>>().toExtend<{params:{conversationId:string};body:{muted:boolean};idempotencyKey:string;ifMatch:string}>();
});
it('encodes v2 messages using their actual version and unchanged code-point text', async () => {
 const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({data:{},meta:{}}), {status:201,headers:{'content-type':'application/json'}}));
 const client = createApiClient({baseUrl:'https://synthetic.example',credentials:{kind:'bearer',accessToken:()=> 'synthetic-token'},fetch:fetcher});
 const body = {body:'😀 @everyone',clientMessageId:'1cfa74bd-0984-4c65-832e-a7523d8cb318',mentions:[{kind:'everyone' as const,start:2,end:11}]};
 await client.call('sendGroupMessageV2',{params:{conversationId:'group'},body});
 expect(fetcher.mock.calls[0]?.[0]).toBe('https://synthetic.example/v2/conversations/group/messages');
 expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(body);
 expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({authorization:'Bearer synthetic-token'});
});
