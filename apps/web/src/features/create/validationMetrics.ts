/** Fixed validation vocabulary only; copy/input values never leave the form. */
const ISSUES:Record<string,readonly [string,string]>={
  'Choose a restaurant from search results.':['venue','required'],
  'This restaurant’s details can’t be verified right now. Choose another restaurant.':['venue','unavailable'],
  'The minimum can’t be more than the table size.':['minimum','out_of_range'],
  'Choose a date.':['date','required'],
  'Choose a planned time in half-hour steps.':['time','invalid'],
  'Choose when applications close.':['closeTime','required'],
  'Applications must close at least 30 minutes before the meal.':['closeTime','out_of_range'],
  'Give your meal a name of 5–80 characters.':['title','invalid'],
  'Describe your meal in 20–1,000 characters.':['description','invalid'],
  'Choose an atmosphere.':['mood','required'],
  'Choose at least one conversation language.':['languages','required'],
  'Enter an estimated spend per person in pounds.':['budgetMin','invalid'],
  'The upper budget can’t be lower than the starting budget.':['budgetMax','out_of_range'],
  'Confirm your restaurant reservation to continue.':['bookingConfirmed','required'],
  'Confirm you’ve checked the arrangements and the cancellation terms.':['reviewConfirmed','required'],
};
export function validationMetric(attemptId:string,step:number,message:string) {
  const issue=ISSUES[message];
  if(!issue)return null;
  return {attemptId,step:['arrange','introduce','costs','review'][step]!,field:issue[0],errorCode:issue[1]};
}

const SERVER_FIELDS:Record<string,readonly [string,string]>={
  venueRef:['arrange','venue'],capacity:['arrange','capacity'],minimum:['arrange','minimum'],start:['arrange','time'],close:['arrange','closeTime'],
  title:['introduce','title'],description:['introduce','description'],mood:['introduce','mood'],languages:['introduce','languages'],
  budgetMinPence:['costs','budgetMin'],budgetMaxPence:['costs','budgetMax'],bookingDeclarationConfirmed:['costs','bookingConfirmed'],reviewConfirmed:['review','reviewConfirmed'],
};
export function serverValidationMetrics(attemptId:string,fields:Record<string,string>|undefined) {
  return Object.keys(fields??{}).flatMap(key=>{const mapping=SERVER_FIELDS[key];return mapping?[{attemptId,step:mapping[0],field:mapping[1],errorCode:'invalid'}]:[];});
}
