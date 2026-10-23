import {redirectSystemPath} from '../../../app/+native-intent.tsx';
const origin='https://p11-share.example.invalid',id='14141414-1414-4141-8141-141414141414';
afterEach(()=>{delete process.env.EXPO_PUBLIC_MEAL_ORIGIN;});
it.each([true,false])('rewrites the configured public meal link for initial=%s without an apply action',initial=>{
 process.env.EXPO_PUBLIC_MEAL_ORIGIN=origin;
 expect(redirectSystemPath({path:`${origin}/meals/${id}`,initial})).toBe(`/meals/${id}`);
});
it.each([`https://evil.invalid/meals/${id}`,`${origin}/meals/${id}/apply`,`${origin}/meals/${id}?returnTo=https://evil.invalid`,`${origin}/meals/not-a-uuid`,`http://p11-share.example.invalid/meals/${id}`,'//evil.invalid/meals/x','  https://evil.invalid/meals/x','h\tttps://evil.invalid/meals/x','https://%'])('rejects an unapproved public link %s',path=>{
 process.env.EXPO_PUBLIC_MEAL_ORIGIN=origin;
 expect(redirectSystemPath({path,initial:true})).toBe('/meal-link-unavailable');
});
it('leaves the existing OAuth callback with its state intact',()=>{
 const path='fancyp11://auth/callback?code=synthetic&state=synthetic';
 expect(redirectSystemPath({path,initial:true})).toBe(path);
});
