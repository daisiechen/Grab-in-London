/** Fixed validation vocabulary only (iOS analytics/form-errors.ts); copy and input values never leave the form. */
const ISSUES: Record<string, readonly [string, string]> = {
  'Choose a restaurant.': ['venue', 'required'],
  'This restaurant can’t be verified right now. Choose another.': ['venue', 'unavailable'],
  'Choose a date and time.': ['time', 'required'],
  'Choose a date from today onwards.': ['date', 'out_of_range'],
  'Choose 2–6 people, including you.': ['capacity', 'out_of_range'],
  'The minimum must be between 2 and the table size.': ['minimum', 'out_of_range'],
  'Choose when applications close.': ['closeTime', 'required'],
  'Applications must close at least 30 minutes before the meal.': ['closeTime', 'out_of_range'],
  'Give your meal a title of 5–80 characters.': ['title', 'invalid'],
  'Tell guests about your meal in 20–1,000 characters.': ['description', 'invalid'],
  'Choose an atmosphere.': ['mood', 'required'],
  'Choose a conversation language.': ['languages', 'required'],
  'Enter a valid budget, with the maximum at least the minimum.': ['budgetMax', 'invalid'],
  'Confirm that you have already booked the table with the restaurant.': ['bookingConfirmed', 'required'],
  'Confirm you’ve reviewed the details before publishing.': ['reviewConfirmed', 'required'],
};
const STEP_NAMES = ['arrange', 'introduce', 'costs', 'review'] as const;
export function validationMetric(attemptId: string, step: number, message: string) {
  const issue = ISSUES[message];
  if (!issue) return null;
  return { attemptId, step: STEP_NAMES[step]!, field: issue[0], errorCode: issue[1] };
}

const SERVER_FIELDS: Record<string, readonly [string, string]> = {
  venueRef: ['arrange', 'venue'], capacity: ['arrange', 'capacity'], minimum: ['arrange', 'minimum'], start: ['arrange', 'time'], close: ['arrange', 'closeTime'],
  title: ['introduce', 'title'], description: ['introduce', 'description'], mood: ['introduce', 'mood'], languages: ['introduce', 'languages'],
  budgetMinPence: ['costs', 'budgetMin'], budgetMaxPence: ['costs', 'budgetMax'], bookingDeclarationConfirmed: ['costs', 'bookingConfirmed'], reviewConfirmed: ['review', 'reviewConfirmed'],
};
export function serverValidationMetrics(attemptId: string, fields: Record<string, string> | undefined) {
  return Object.keys(fields ?? {}).flatMap((key) => { const mapping = SERVER_FIELDS[key]; return mapping ? [{ attemptId, step: mapping[0], field: mapping[1], errorCode: 'invalid' }] : []; });
}
