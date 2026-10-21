import {expect,it} from 'vitest';
import {screen} from '@testing-library/react';
import {createFetchStub,ok,page} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
import {MEAL_ID,session} from '../../test/fixtures.ts';

it('QA-JOURNEY-003 live group permission never asserts a cancelled or unknown seat is confirmed',async()=>{
 const s=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([{conversation:{id:'14141414-1414-4141-8141-141414141414',version:'3',kind:'GROUP',mealId:MEAL_ID,title:'Seat cancelled, group retained',canSend:true,dissolved:false,head:'5'},lastMessage:null,unreadCount:0}])});
 renderApp(s.fetch,'/inbox');
 const row=await screen.findByRole('link',{name:/Seat cancelled, group retained/});
 expect(row.textContent).toContain('Meal group');
 expect(row.textContent).not.toContain('Seat confirmed');
 expect(s.callsTo('sendMessage')).toHaveLength(0);
});
