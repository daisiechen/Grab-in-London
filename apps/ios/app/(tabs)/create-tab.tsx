import { Redirect } from 'expo-router';

/** Tab slot for the raised Create circle; the button itself navigates to /create, this route only redirects. */
export default function CreateTab() {
  return <Redirect href="/create" />;
}
