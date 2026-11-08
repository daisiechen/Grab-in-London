import {expect,it} from 'vitest';
import {screen} from '@testing-library/react';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok,page} from '../../test/fetchStub.ts';
import {MEAL_ID,session} from '../../test/fixtures.ts';
it('labels a retained live meal group without claiming the member still has a confirmed seat',async()=>{
 // Cancellation changes the application/seat; an open membership independently permits this inbox row.
 // The inbox projection supplies group permission, not an application/seat confirmation fact.
 const stub=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([{conversation:{id:'14141414-1414-4141-8141-141414141414',version:'3',kind:'GROUP',mealId:MEAL_ID,title:'Retained group after seat cancellation',canSend:true,dissolved:false,head:'12'},lastMessage:null,unreadCount:0}])});
 renderApp(stub.fetch,'/inbox');await screen.findByText('Retained group after seat cancellation');
 expect(screen.queryByText(/Seat confirmed/)).toBeNull();expect(screen.getByText('Meal group')).toBeTruthy();
 expect(screen.getByRole('link',{name:/Retained group after seat cancellation/}).getAttribute('href')).toBe('/chat/14141414-1414-4141-8141-141414141414');
});
