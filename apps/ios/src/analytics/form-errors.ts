import type { Properties } from './allowlist.ts';
const messages:Record<string,readonly [string,string,string]>={
 'Choose a restaurant.':['arrange','venue','required'],
 'Choose a date and time.':['arrange','time','required'],
 'Choose a date from today onwards.':['arrange','date','out_of_range'],
 'Choose 2–6 people, including you.':['arrange','capacity','out_of_range'],
 'The minimum must be between 2 and the table size.':['arrange','minimum','out_of_range'],
 'Choose when applications close.':['arrange','closeTime','required'],
 'Applications must close at least 30 minutes before the meal.':['arrange','closeTime','out_of_range'],
 'Give your meal a title of 5–80 characters.':['introduce','title','invalid'],
 'Tell guests about your meal in 20–1,000 characters.':['introduce','description','invalid'],
 'Choose an atmosphere.':['introduce','mood','required'],
 'Choose a conversation language.':['introduce','languages','required'],
 'Enter a valid budget, with the maximum at least the minimum.':['costs','budgetMax','invalid'],
 'Confirm that you’ll reserve the table with the restaurant yourself.':['costs','bookingConfirmed','required'],
 'Confirm you’ve reviewed the details before publishing.':['review','reviewConfirmed','required'],
};
export function formErrorProperties(attemptId:string,message:string):Properties|null {
 const fixed=messages[message];return fixed?{attemptId,step:fixed[0],field:fixed[1],errorCode:fixed[2]}:null;
}
export function serverFormErrors(attemptId:string,fields:Record<string,string>|undefined):Properties[]{
 const mapping:Record<string,readonly [string,string]>={venueRef:['arrange','venue'],capacity:['arrange','capacity'],minimum:['arrange','minimum'],start:['arrange','time'],close:['arrange','closeTime'],title:['introduce','title'],description:['introduce','description'],mood:['introduce','mood'],languages:['introduce','languages'],budgetMinPence:['costs','budgetMin'],budgetMaxPence:['costs','budgetMax'],bookingDeclarationConfirmed:['costs','bookingConfirmed'],reviewConfirmed:['review','reviewConfirmed']};
 return Object.keys(fields??{}).flatMap(field=>{const fixed=mapping[field];return fixed?[{attemptId,step:fixed[0],field:fixed[1],errorCode:'invalid'}]:[];});
}
