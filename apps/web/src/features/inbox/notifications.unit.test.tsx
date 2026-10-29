import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, deferred, fail, ok, page, type StubResponse } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { readNotifications } from './NotificationsPage.tsx';
import { testApi } from '../../test/render.tsx';
import { MEAL_ID, session } from '../../test/fixtures.ts';
const ID='92929292-9292-4292-8292-929292929292';
const item=(over:Record<string,unknown>={})=>({id:ID,template:'meal_cancelled',createdAt:'2026-10-22T16:00:00.000Z',readAt:null,mealId:MEAL_ID,applicationId:null,conversationId:null,...over});
describe('F50 own notifications',()=>{
 it('rejects repeated page cursors instead of presenting a partial feed as complete',async()=>{
  const s=createFetchStub({listNotifications:()=>page([item()], 'stuck')});
  await expect(readNotifications(testApi(s.fetch).client)).rejects.toThrow('Pagination did not advance');
  expect(s.callsTo('listNotifications')).toHaveLength(2);
 });
 it('routes the Inbox link to notifications, reads every page, and marks only on explicit action',async()=>{
  const held=deferred<StubResponse>();
  const s=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([]),listNotifications:({url})=>url.searchParams.has('cursor')?page([item({id:'93939393-9393-4393-8393-939393939393',template:'future_template',readAt:'2026-10-22T16:01:00.000Z',mealId:null})]):page([item()],'next'),markRead:()=>held.promise});
  renderApp(s.fetch,'/inbox');await userEvent.click(await screen.findByRole('link',{name:'Notifications'}));
  expect(await screen.findByText('Meal cancelled')).toBeTruthy();expect(await screen.findByText('You have an update.')).toBeTruthy();
  expect(s.callsTo('listNotifications').map(c=>c.url.searchParams.get('cursor'))).toContain('next');expect(s.callsTo('inbox')).toHaveLength(1);expect(s.callsTo('readMessages')).toHaveLength(0);expect(s.callsTo('markRead')).toHaveLength(0);
  expect(screen.getByRole('link',{name:/^Meal cancelled, .*unread$/}).getAttribute('href')).toBe(`/meals/${MEAL_ID}`);
  const button=screen.getByRole('button',{name:'Mark as read'});await userEvent.dblClick(button);expect(s.callsTo('markRead')).toHaveLength(1);expect(button.hasAttribute('disabled')).toBe(true);
  expect(s.callsTo('markRead')[0]!.params.notificationId).toBe(ID);expect(s.callsTo('markRead')[0]!.headers['idempotency-key']).toBeTruthy();
  await act(async()=>held.resolve(ok(item({readAt:'2026-10-22T16:01:00.000Z'}))));await waitFor(()=>expect(screen.queryByRole('button',{name:'Mark as read'})).toBeNull());
 });
 it('keeps failed first reads distinct from empty and explicitly retries',async()=>{
  let n=0;const s=createFetchStub({getSession:()=>ok(session()),listNotifications:()=>++n===1?fail(403,'FORBIDDEN'):page([])});
  renderApp(s.fetch,'/inbox/notifications');await screen.findByRole('button',{name:'Retry loading notifications'});expect(screen.queryByText('No notifications yet.')).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'Retry loading notifications'}));expect(await screen.findByText('No notifications yet.')).toBeTruthy();
 });
 it('does not mark a failed write read or expose items after a 401',async()=>{
  let n=0;const s=createFetchStub({getSession:()=>ok(session()),listNotifications:()=>page([item()]),markRead:()=>++n===1?fail(403,'FORBIDDEN'):fail(401,'AUTH_REQUIRED')});
  renderApp(s.fetch,'/inbox/notifications');await userEvent.click(await screen.findByRole('button',{name:'Mark as read'}));await screen.findByRole('alert');
  expect(screen.getByRole('link',{name:/unread$/})).toBeTruthy();await userEvent.click(screen.getByRole('button',{name:'Mark as read'}));await waitFor(()=>expect(screen.queryByText('Meal cancelled')).toBeNull());
 });
});
