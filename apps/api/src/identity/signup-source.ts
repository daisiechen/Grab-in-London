/**
 * Campaign-level sign-up source (ops analytics review P0-3, contracts `SignupSource`). The result is
 * the users.signup_source value: 'ios_app', 'meal_link', or 'source:medium:campaign' built from utm
 * values (medium/campaign may be empty). Anything unusable is dropped rather than failing sign-in.
 */
export interface SignupSourceInput {utmSource?:string;utmMedium?:string;utmCampaign?:string;entry?:'meal_link'|'ios_app'}

const segment=(value:string|undefined)=>(value??'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'');

export function normalizeSignupSource(input:SignupSourceInput|undefined|null):string|null{
 if(!input)return null;
 const source=segment(input.utmSource);
 if(source){
  const medium=segment(input.utmMedium),campaign=segment(input.utmCampaign);
  return campaign?`${source}:${medium}:${campaign}`:medium?`${source}:${medium}`:source;
 }
 return input.entry==='meal_link'||input.entry==='ios_app'?input.entry:null;
}
